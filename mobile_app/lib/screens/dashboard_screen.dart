import 'dart:async';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fluttertoast/fluttertoast.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../models/attendance_record.dart';
import '../models/schedule.dart';
import '../widgets/common_widgets.dart';
import 'attendance_form_screen.dart';
import 'history_screen.dart';
import 'login_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  final _authService = AuthService();
  final _firestoreService = FirestoreService();

  String _checkerName = '';
  int _offlineCount = 0;
  bool _isSyncing = false;

  
  Timer? _notifTimer;
  StreamSubscription<QuerySnapshot>? _noClassSubscription;
  List<_NotifItem> _notifications = [];
  final Set<String> _dismissedKeys = {};
  final Set<String> _readKeys = {}; 
  final Set<String> _autoShownKeys = {}; 
  bool _isNotifPanelOpen = false;

  @override
  void initState() {
    super.initState();
    _loadReadKeys();
    _loadDismissedKeys();
    _loadUserData();
    _checkOfflineRecords();
    _startNotificationMonitor();
    _startNoClassMonitor();
  }

  static const String _readKeysPrefKey = 'read_notification_keys';
  static const String _dismissedKeysPrefKey = 'dismissed_notification_keys';

  Future<void> _loadReadKeys() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getStringList(_readKeysPrefKey);
      if (keys != null && mounted) {
        setState(() {
          _readKeys.addAll(keys);
        });
      }
    } catch (_) {}
  }

  Future<void> _saveReadKeys() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_readKeysPrefKey, _readKeys.toList());
    } catch (_) {}
  }

  Future<void> _loadDismissedKeys() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final keys = prefs.getStringList(_dismissedKeysPrefKey);
      if (keys != null && mounted) {
        setState(() {
          _dismissedKeys.addAll(keys);
        });
      }
    } catch (_) {}
  }

  Future<void> _saveDismissedKeys() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setStringList(_dismissedKeysPrefKey, _dismissedKeys.toList());
    } catch (_) {}
  }

  @override
  void dispose() {
    _notifTimer?.cancel();
    _noClassSubscription?.cancel();
    super.dispose();
  }

  void _startNoClassMonitor() {
    bool isInitial = true;
    _noClassSubscription = _firestoreService.getNoClassDatesStream().listen((snapshot) {
      if (isInitial) {
        isInitial = false;
        return;
      }

      for (var change in snapshot.docChanges) {
        final data = change.doc.data() as Map<String, dynamic>?;
        if (data == null) continue;
        final reason = data['reason'] as String? ?? 'No Class';
        final ts = data['date'] as Timestamp?;
        if (ts == null) continue;
        final date = ts.toDate();
        final formattedDate = DateFormat('MMMM d, yyyy').format(date);

        if (change.type == DocumentChangeType.added) {
          Fluttertoast.showToast(
            msg: "📅 New Calendar Event\nNo Class Day added: \"$reason\" on $formattedDate",
            toastLength: Toast.LENGTH_LONG,
            gravity: ToastGravity.TOP,
            backgroundColor: Colors.purple,
            textColor: Colors.white,
            fontSize: 14.0,
          );
        } else if (change.type == DocumentChangeType.removed) {
          Fluttertoast.showToast(
            msg: "📅 Calendar Updated\nNo Class Day cancelled: \"$reason\" on $formattedDate has been removed.",
            toastLength: Toast.LENGTH_LONG,
            gravity: ToastGravity.TOP,
            backgroundColor: Colors.green,
            textColor: Colors.white,
            fontSize: 14.0,
          );
        }
      }
      _refreshNotifications();
    });
  }

  void _startNotificationMonitor() {
    _refreshNotifications();
    _notifTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => _refreshNotifications(),
    );
  }

  
  static String _formatTime12(String t) {
    final parts = t.split(':');
    if (parts.length != 2) return t;
    final h = int.tryParse(parts[0]) ?? 0;
    final m = int.tryParse(parts[1]) ?? 0;
    final suffix = h >= 12 ? 'PM' : 'AM';
    final h12 = h % 12 == 0 ? 12 : h % 12;
    return '$h12:${m.toString().padLeft(2, '0')} $suffix';
  }

  Future<void> _refreshNotifications() async {
    final now = DateTime.now();
    final todayName = DateFormat('EEEE').format(now);
    final todayStr = DateFormat('yyyy-MM-dd').format(now);
    final nowMin = now.hour * 60 + now.minute;
    final checkerId = _authService.currentUser?.uid ?? '';
    final List<_NotifItem> items = [];

    try {
      
      for (int d = 0; d <= 3; d++) {
        final date = now.add(Duration(days: d));
        final reason = await _firestoreService.getNoClassReason(date);
        if (reason != null) {
          final dateStr = d == 0
              ? 'Today'
              : d == 1
                  ? 'Tomorrow'
                  : DateFormat('EEE, MMM d').format(date);
          final key = 'cal_${DateFormat('yyyy-MM-dd').format(date)}';
          if (!_dismissedKeys.contains(key)) {
            items.add(_NotifItem(
              key: key,
              type: _NotifType.calendar,
              title: '$dateStr: $reason',
              subtitle: d == 0
                  ? 'No classes scheduled today'
                  : 'No classes on ${DateFormat('MMMM d').format(date)}',
              icon: Icons.event_busy,
              color: Colors.purple,
            ));
          }
        }
      }

      
      final schedules = await _firestoreService
          .getSchedules(dayOfWeek: todayName)
          .first;

      
      List<AttendanceRecord> todayRecords = [];
      if (checkerId.isNotEmpty) {
        todayRecords = await _firestoreService
            .getTodayRecords(checkerId)
            .first;
      }

      
      final checkedKeys = <String>{};
      for (var r in todayRecords) {
        if (r.subjectSchedule != null && r.subjectSchedule!.isNotEmpty) {
          checkedKeys.add(r.subjectSchedule!);
        }
        checkedKeys.add('inst_${r.instructorId}_${r.roomId}');
      }

      for (final s in schedules) {
        final parts = s.startTime.split(':');
        if (parts.length != 2) continue;
        final startMin = int.parse(parts[0]) * 60 + int.parse(parts[1]);

        final endParts = s.endTime.split(':');
        if (endParts.length != 2) continue;
        final endMin = int.parse(endParts[0]) * 60 + int.parse(endParts[1]);

        final isChecked = checkedKeys.contains(s.displayText) ||
            checkedKeys.contains('inst_${s.instructorId}_${s.roomId}');

        
        final diff = startMin - nowMin;
        if (diff > 0 && diff <= 10) {
          final key = 'upcoming_${s.id}_$todayStr';
          if (!_dismissedKeys.contains(key)) {
            items.add(_NotifItem(
              key: key,
              type: _NotifType.upcoming,
              title: 'Upcoming in $diff min${diff == 1 ? '' : 's'}',
              subtitle: '${s.subject} • ${_formatTime12(s.startTime)} - ${_formatTime12(s.endTime)}',
              icon: Icons.notifications_active,
              color: AppColors.warning,
              schedule: s,
            ));
          }
        }

        
        if (nowMin > endMin && !isChecked) {
          final key = 'missed_${s.id}_$todayStr';
          if (!_dismissedKeys.contains(key)) {
            items.add(_NotifItem(
              key: key,
              type: _NotifType.missed,
              title: 'Missed check',
              subtitle: '${s.subject} • ${_formatTime12(s.startTime)} - ${_formatTime12(s.endTime)}',
              icon: Icons.warning_amber_rounded,
              color: AppColors.error,
              schedule: s,
            ));
          }
        }
      }
    } catch (_) {}

    if (mounted) {
      final hadNew = items.any((n) =>
          !_autoShownKeys.contains(n.key) &&
          (n.type == _NotifType.upcoming || n.type == _NotifType.missed));

      setState(() => _notifications = items);

      
      if (hadNew && !_isNotifPanelOpen && items.isNotEmpty) {
        for (var n in items) {
          _autoShownKeys.add(n.key);
        }
        
        Future.delayed(const Duration(milliseconds: 500), () {
          if (mounted && !_isNotifPanelOpen) {
            _showNotificationPopup();
          }
        });
      }
    }
  }

  void _dismissNotif(String key) {
    setState(() {
      _dismissedKeys.add(key);
      _notifications.removeWhere((n) => n.key == key);
    });
    _saveDismissedKeys();
  }

  void _markNotifRead(String key) {
    setState(() {
      _readKeys.add(key);
    });
    _saveReadKeys();
  }

  int get _unreadCount => _notifications.where((n) => !_readKeys.contains(n.key)).length;

  void _showNotificationPanel() {
    _showNotificationPopup();
  }

  void _showNotificationPopup() {
    if (_isNotifPanelOpen) return;
    _isNotifPanelOpen = true;

    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Notifications',
      barrierColor: Colors.black54,
      transitionDuration: const Duration(milliseconds: 300),
      transitionBuilder: (context, anim, secondAnim, child) {
        return SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0, -0.3),
            end: Offset.zero,
          ).animate(CurvedAnimation(parent: anim, curve: Curves.easeOutCubic)),
          child: FadeTransition(opacity: anim, child: child),
        );
      },
      pageBuilder: (context, anim, secondAnim) {
        return _NotificationOverlay(
          notifications: _notifications,
          readKeys: _readKeys,
          onDismiss: (key) {
            _dismissNotif(key);
          },
          onMarkRead: (key) {
            _markNotifRead(key);
          },
          onMarkAllRead: () {
            setState(() {
              for (var n in _notifications) {
                _readKeys.add(n.key);
              }
            });
            _saveReadKeys();
          },
          onDismissAll: () {
            setState(() {
              for (var n in _notifications) {
                _dismissedKeys.add(n.key);
              }
              _notifications.clear();
            });
            _saveDismissedKeys();
            Navigator.pop(context);
          },
          onClose: () => Navigator.pop(context),
        );
      },
    ).then((_) {
      _isNotifPanelOpen = false;
    });
  }

  Future<void> _loadUserData() async {
    final name = await _authService.getUserFullName();
    if (mounted) {
      setState(() => _checkerName = name);
    }
  }

  Future<void> _checkOfflineRecords() async {
    final count = await _firestoreService.getOfflineRecordCount();
    if (mounted) {
      setState(() => _offlineCount = count);
    }
  }

  Future<void> _syncOfflineRecords() async {
    setState(() => _isSyncing = true);
    try {
      final synced = await _firestoreService.syncOfflineRecords();
      await _checkOfflineRecords();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('$synced record(s) synced successfully!'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Sync failed: $e'),
            backgroundColor: AppColors.error,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSyncing = false);
    }
  }

  Future<void> _handleLogout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Sign Out'),
        content: const Text('Are you sure you want to sign out?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
            ),
            child: const Text('Sign Out'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await _authService.signOut();
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final checkerId = _authService.currentUser?.uid ?? '';
    final today = DateFormat('EEEE, MMMM d, yyyy').format(DateTime.now());
    final greeting = _getGreeting();

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/images/spct-logo.png',
              height: 32,
              errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
            ),
            const SizedBox(width: 8),
            Text(
              'SPCT',
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.w600,
                fontSize: 20,
              ),
            ),
          ],
        ),
        actions: [
          
          IconButton(
            onPressed: _showNotificationPanel,
            icon: Badge(
              isLabelVisible: _unreadCount > 0,
              label: Text('$_unreadCount'),
              backgroundColor: AppColors.error,
              child: const Icon(Icons.notifications_outlined),
            ),
            tooltip: 'Notifications',
          ),
          
          if (_offlineCount > 0)
            IconButton(
              onPressed: _isSyncing ? null : _syncOfflineRecords,
              icon: Badge(
                label: Text('$_offlineCount'),
                child: _isSyncing
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(Icons.sync),
              ),
              tooltip: 'Sync offline records',
            ),
          IconButton(
            onPressed: _handleLogout,
            icon: const Icon(Icons.logout),
            tooltip: 'Sign Out',
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async {
          await _checkOfflineRecords();
          setState(() {});
        },
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryDark],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.primary.withOpacity(0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          width: 48,
                          height: 48,
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(14),
                          ),
                          child: Center(
                            child: Text(
                              _checkerName.isNotEmpty
                                  ? _checkerName[0].toUpperCase()
                                  : 'C',
                              style: GoogleFonts.poppins(
                                fontSize: 22,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                '$greeting,',
                                style: GoogleFonts.poppins(
                                  fontSize: 14,
                                  color: Colors.white.withOpacity(0.8),
                                ),
                              ),
                              Text(
                                _checkerName.isNotEmpty ? _checkerName : 'Checker',
                                style: GoogleFonts.poppins(
                                  fontSize: 20,
                                  fontWeight: FontWeight.w700,
                                  color: Colors.white,
                                ),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.calendar_today,
                              size: 14, color: Colors.white.withOpacity(0.9)),
                          const SizedBox(width: 6),
                          Text(
                            today,
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              color: Colors.white.withOpacity(0.9),
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              
              if (_unreadCount > 0)
                GestureDetector(
                  onTap: _showNotificationPanel,
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          (_notifications.any((n) => !_readKeys.contains(n.key) && n.type == _NotifType.missed)
                                  ? AppColors.error
                                  : _notifications.any((n) => !_readKeys.contains(n.key) && n.type == _NotifType.upcoming)
                                      ? AppColors.warning
                                      : Colors.purple)
                              .withOpacity(0.12),
                          (_notifications.any((n) => !_readKeys.contains(n.key) && n.type == _NotifType.missed)
                                  ? AppColors.error
                                  : _notifications.any((n) => !_readKeys.contains(n.key) && n.type == _NotifType.upcoming)
                                      ? AppColors.warning
                                      : Colors.purple)
                              .withOpacity(0.04),
                        ],
                      ),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: (_notifications.any((n) => !_readKeys.contains(n.key) && n.type == _NotifType.missed)
                                ? AppColors.error
                                : _notifications.any((n) => !_readKeys.contains(n.key) && n.type == _NotifType.upcoming)
                                    ? AppColors.warning
                                    : Colors.purple)
                            .withOpacity(0.3),
                      ),
                    ),
                    child: Row(
                      children: [
                        Icon(
                          _notifications.any((n) => !_readKeys.contains(n.key) && n.type == _NotifType.missed)
                              ? Icons.warning_amber_rounded
                              : Icons.notifications_active,
                          color: _notifications.any((n) => !_readKeys.contains(n.key) && n.type == _NotifType.missed)
                              ? AppColors.error
                              : AppColors.warning,
                          size: 22,
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _buildNotifSummaryText(),
                            style: GoogleFonts.poppins(
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                              color: AppColors.textPrimary,
                            ),
                          ),
                        ),
                        Icon(Icons.chevron_right, color: Colors.grey.shade400, size: 20),
                      ],
                    ),
                  ),
                ),

              
              if (_offlineCount > 0)
                Container(
                  padding: const EdgeInsets.all(12),
                  margin: const EdgeInsets.only(bottom: 16),
                  decoration: BoxDecoration(
                    color: AppColors.warning.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: AppColors.warning.withOpacity(0.3),
                    ),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.cloud_off, color: AppColors.warning),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          '$_offlineCount record(s) saved offline. Tap sync to upload.',
                          style: const TextStyle(color: AppColors.warning),
                        ),
                      ),
                    ],
                  ),
                ),

              
              Row(
                children: [
                  Text(
                    "Today's Summary",
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  const Spacer(),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: AppColors.primary.withOpacity(0.08),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      'Live',
                      style: GoogleFonts.poppins(
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              FutureBuilder<Map<String, int>>(
                future: _firestoreService.getTodaySummary(checkerId),
                builder: (context, snapshot) {
                  final data = snapshot.data ??
                      {'total': 0, 'present': 0, 'notTeaching': 0, 'late': 0, 'absent': 0};

                  return GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                    childAspectRatio: 1.5,
                    children: [
                      SummaryCard(
                        title: 'Total Checks',
                        count: '${data['total']}',
                        icon: Icons.assignment_rounded,
                        color: AppColors.primary,
                      ),
                      SummaryCard(
                        title: 'Present',
                        count: '${data['present']}',
                        icon: Icons.check_circle_rounded,
                        color: AppColors.present,
                      ),
                      SummaryCard(
                        title: 'Not Teaching',
                        count: '${data['notTeaching']}',
                        icon: Icons.person_outline,
                        color: AppColors.notTeaching,
                      ),
                      SummaryCard(
                        title: 'Late',
                        count: '${data['late']}',
                        icon: Icons.access_time_filled,
                        color: AppColors.late,
                      ),
                      SummaryCard(
                        title: 'Absent',
                        count: '${data['absent']}',
                        icon: Icons.cancel_rounded,
                        color: AppColors.absent,
                      ),
                    ],
                  );
                },
              ),
              const SizedBox(height: 28),

              
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Recent Records',
                    style: GoogleFonts.poppins(
                      fontSize: 18,
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPrimary,
                    ),
                  ),
                  TextButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                            builder: (_) => const HistoryScreen()),
                      );
                    },
                    icon: const Text('View All'),
                    label: const Icon(Icons.arrow_forward_ios, size: 14),
                  ),
                ],
              ),
              const SizedBox(height: 8),

              StreamBuilder<List<AttendanceRecord>>(
                stream: _firestoreService.getTodayRecords(checkerId),
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const Center(child: CircularProgressIndicator());
                  }

                  final records = snapshot.data ?? [];

                  if (records.isEmpty) {
                    return Container(
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(vertical: 40),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                      ),
                      child: const EmptyStateWidget(
                        icon: Icons.assignment_outlined,
                        title: 'No records yet',
                        subtitle:
                            'Start by checking an instructor\'s attendance',
                      ),
                    );
                  }

                  return Container(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(16),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.04),
                          blurRadius: 10,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: records.length > 5 ? 5 : records.length,
                      separatorBuilder: (_, __) => Divider(
                        height: 1,
                        color: Colors.grey.shade100,
                        indent: 72,
                      ),
                      itemBuilder: (context, index) {
                        final record = records[index];
                        return _buildRecordTile(record);
                      },
                    ),
                  );
                },
              ),
              const SizedBox(height: 80), 
            ],
          ),
        ),
      ),

      
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(
                builder: (_) => const AttendanceFormScreen()),
          );
          if (result == true) {
            setState(() {});
            _checkOfflineRecords();
          }
        },
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add),
        label: const Text('New Check'),
        elevation: 4,
      ),
    );
  }

  String _getGreeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  }

  String _buildNotifSummaryText() {
    final unreadList = _notifications.where((n) => !_readKeys.contains(n.key)).toList();
    final missed = unreadList.where((n) => n.type == _NotifType.missed).length;
    final upcoming = unreadList.where((n) => n.type == _NotifType.upcoming).length;
    final calendar = unreadList.where((n) => n.type == _NotifType.calendar).length;
    final parts = <String>[];
    if (missed > 0) parts.add('$missed missed check${missed > 1 ? 's' : ''}');
    if (upcoming > 0) parts.add('$upcoming upcoming');
    if (calendar > 0) parts.add('$calendar calendar event${calendar > 1 ? 's' : ''}');
    return parts.join(' · ') + ' — Tap to view';
  }

  Widget _buildRecordTile(AttendanceRecord record) {
    Color statusColor;
    IconData statusIcon;
    switch (record.status) {
      case 'Present':
        statusColor = AppColors.present;
        statusIcon = Icons.check_circle_rounded;
        break;
      case 'Present (Not Teaching)':
        statusColor = AppColors.notTeaching;
        statusIcon = Icons.person_outline;
        break;
      case 'Late':
        statusColor = AppColors.late;
        statusIcon = Icons.access_time_filled;
        break;
      case 'Absent':
        statusColor = AppColors.absent;
        statusIcon = Icons.cancel_rounded;
        break;
      default:
        statusColor = Colors.grey;
        statusIcon = Icons.help;
    }

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.primary.withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Center(
              child: Text(
                record.instructorName.isNotEmpty
                    ? record.instructorName[0].toUpperCase()
                    : '?',
                style: GoogleFonts.poppins(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
          const SizedBox(width: 14),
          
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  record.instructorName,
                  style: GoogleFonts.poppins(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  '${record.roomName}  •  ${DateFormat('hh:mm a').format(record.dateTime)}',
                  style: GoogleFonts.poppins(
                    fontSize: 12,
                    color: AppColors.textSecondary,
                  ),
                ),                if (record.remarks != null && record.remarks!.isNotEmpty) ...[                  const SizedBox(height: 2),
                  Text(
                    record.remarks!,
                    style: GoogleFonts.poppins(
                      fontSize: 11,
                      fontStyle: FontStyle.italic,
                      color: AppColors.notTeaching,
                    ),
                    overflow: TextOverflow.ellipsis,
                    maxLines: 1,
                  ),
                ],              ],
            ),
          ),
          
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
            decoration: BoxDecoration(
              color: statusColor.withOpacity(0.1),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(statusIcon, size: 14, color: statusColor),
                const SizedBox(width: 4),
                Text(
                  record.status,
                  style: GoogleFonts.poppins(
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    color: statusColor,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

enum _NotifType { upcoming, missed, calendar }

class _NotifItem {
  final String key;
  final _NotifType type;
  final String title;
  final String subtitle;
  final IconData icon;
  final Color color;
  final Schedule? schedule;

  _NotifItem({
    required this.key,
    required this.type,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.color,
    this.schedule,
  });
}

class _NotificationOverlay extends StatefulWidget {
  final List<_NotifItem> notifications;
  final Set<String> readKeys;
  final void Function(String key) onDismiss;
  final void Function(String key) onMarkRead;
  final VoidCallback onMarkAllRead;
  final VoidCallback onDismissAll;
  final VoidCallback onClose;

  const _NotificationOverlay({
    required this.notifications,
    required this.readKeys,
    required this.onDismiss,
    required this.onMarkRead,
    required this.onMarkAllRead,
    required this.onDismissAll,
    required this.onClose,
  });

  @override
  State<_NotificationOverlay> createState() => _NotificationOverlayState();
}

class _NotificationOverlayState extends State<_NotificationOverlay> {
  late List<_NotifItem> _items;

  @override
  void initState() {
    super.initState();
    _items = List.from(widget.notifications);
  }

  @override
  void didUpdateWidget(covariant _NotificationOverlay old) {
    super.didUpdateWidget(old);
    _items = List.from(widget.notifications);
  }

  void _handleDismiss(String key) {
    setState(() {
      _items.removeWhere((n) => n.key == key);
    });
    widget.onDismiss(key);
    final unreadRemaining = _items.where((n) => !widget.readKeys.contains(n.key)).length;
    if (unreadRemaining == 0) {
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    final screen = MediaQuery.of(context).size;
    final topPad = MediaQuery.of(context).padding.top;
    
    final panelWidth = screen.width < 420 ? screen.width - 24 : 396.0;
    
    final maxH = screen.height * 0.7;

    final unreadItems = _items.where((n) => !widget.readKeys.contains(n.key)).toList();

    return Stack(
      children: [
        Positioned(
          top: topPad + 56, 
          left: (screen.width - panelWidth) / 2,
          child: Material(
            color: Colors.transparent,
            child: Container(
              width: panelWidth,
              constraints: BoxConstraints(maxHeight: maxH),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.18),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  
                  Padding(
                    padding: const EdgeInsets.fromLTRB(18, 16, 10, 10),
                    child: Row(
                      children: [
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.primary.withOpacity(0.1),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.notifications,
                              color: AppColors.primary, size: 20),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'Notifications',
                                style: GoogleFonts.poppins(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.textPrimary,
                                ),
                              ),
                              if (unreadItems.isNotEmpty)
                                Text(
                                  "${unreadItems.length} alert${unreadItems.length > 1 ? 's' : ''}",
                                  style: GoogleFonts.poppins(
                                    fontSize: 11,
                                    color: AppColors.textSecondary,
                                  ),
                                ),
                            ],
                          ),
                        ),
                        if (unreadItems.isNotEmpty)
                          TextButton(
                            onPressed: widget.onMarkAllRead,
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: Text(
                              'Mark All Read',
                              style: GoogleFonts.poppins(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                          ),
                        if (unreadItems.isNotEmpty)
                          TextButton(
                            onPressed: widget.onDismissAll,
                            style: TextButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 8),
                              minimumSize: Size.zero,
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            ),
                            child: Text(
                              'Clear All',
                              style: GoogleFonts.poppins(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w600,
                                  color: AppColors.error,
                              ),
                            ),
                          ),
                        IconButton(
                          onPressed: widget.onClose,
                          icon: const Icon(Icons.close, size: 20),
                          padding: EdgeInsets.zero,
                          constraints: const BoxConstraints(
                            minWidth: 32,
                            minHeight: 32,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Divider(height: 1, color: Colors.grey.shade200),
                  
                  if (unreadItems.isEmpty)
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 32),
                      child: Column(
                        children: [
                          Icon(Icons.notifications_none,
                              size: 40, color: Colors.grey.shade300),
                          const SizedBox(height: 8),
                          Text(
                            'All caught up!',
                            style: GoogleFonts.poppins(
                              fontSize: 13,
                              color: AppColors.textSecondary,
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    Flexible(
                      child: ListView.builder(
                        shrinkWrap: true,
                        padding: const EdgeInsets.symmetric(vertical: 6),
                        itemCount: unreadItems.length,
                        itemBuilder: (context, index) {
                          final n = unreadItems[index];
                          final isRead = widget.readKeys.contains(n.key);
                          return Dismissible(
                            key: ValueKey(n.key),
                            direction: DismissDirection.endToStart,
                            onDismissed: (_) => _handleDismiss(n.key),
                            background: Container(
                              alignment: Alignment.centerRight,
                              padding: const EdgeInsets.only(right: 16),
                              margin: const EdgeInsets.symmetric(
                                  horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.red.shade50,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Icon(Icons.delete_outline,
                                  color: Colors.red.shade300, size: 20),
                            ),
                            child: Opacity(
                              opacity: isRead ? 0.5 : 1.0,
                              child: Container(
                                margin: const EdgeInsets.symmetric(
                                    horizontal: 10, vertical: 4),
                                padding: const EdgeInsets.all(12),
                                decoration: BoxDecoration(
                                  color: isRead
                                      ? Colors.grey.shade50
                                      : n.color.withOpacity(0.05),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: isRead
                                        ? Colors.grey.shade200
                                        : n.color.withOpacity(0.15),
                                  ),
                                ),
                                child: Row(
                                  children: [
                                    
                                    Container(
                                      width: 38,
                                      height: 38,
                                      decoration: BoxDecoration(
                                        color: isRead
                                            ? Colors.green.withOpacity(0.1)
                                            : n.color.withOpacity(0.12),
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: Icon(
                                          isRead ? Icons.check_circle : n.icon,
                                          color: isRead ? Colors.green : n.color,
                                          size: 18),
                                    ),
                                    const SizedBox(width: 12),
                                    
                                    Expanded(
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          
                                          Container(
                                            padding: const EdgeInsets.symmetric(
                                                horizontal: 6, vertical: 1),
                                            decoration: BoxDecoration(
                                              color: n.color.withOpacity(0.12),
                                              borderRadius:
                                                  BorderRadius.circular(4),
                                            ),
                                            child: Text(
                                              n.type == _NotifType.upcoming
                                                  ? 'UPCOMING'
                                                  : n.type == _NotifType.missed
                                                      ? 'MISSED'
                                                      : 'CALENDAR',
                                              style: GoogleFonts.poppins(
                                                fontSize: 8,
                                                fontWeight: FontWeight.w700,
                                                color: n.color,
                                                letterSpacing: 0.5,
                                              ),
                                            ),
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            n.title,
                                            style: GoogleFonts.poppins(
                                              fontSize: 12,
                                              fontWeight: FontWeight.w600,
                                              color: AppColors.textPrimary,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                          Text(
                                            n.subtitle,
                                            style: GoogleFonts.poppins(
                                              fontSize: 11,
                                              color: AppColors.textSecondary,
                                            ),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                    
                                    GestureDetector(
                                      onTap: isRead
                                          ? null
                                          : () => widget.onMarkRead(n.key),
                                      child: Container(
                                        width: 30,
                                        height: 30,
                                        decoration: BoxDecoration(
                                          color: isRead
                                              ? Colors.green.withOpacity(0.08)
                                              : Colors.grey.shade100,
                                          borderRadius: BorderRadius.circular(15),
                                          border: Border.all(
                                            color: isRead
                                                ? Colors.green.withOpacity(0.3)
                                                : Colors.grey.shade300,
                                          ),
                                        ),
                                        child: Icon(
                                          isRead ? Icons.done_all : Icons.done,
                                          size: 16,
                                          color: isRead
                                              ? Colors.green
                                              : AppColors.textSecondary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  const SizedBox(height: 6),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
