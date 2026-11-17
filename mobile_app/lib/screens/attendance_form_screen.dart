import 'dart:async';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../models/attendance_record.dart';
import '../models/instructor.dart';
import '../models/room.dart';
import '../models/schedule.dart';
import '../widgets/common_widgets.dart';

class AttendanceFormScreen extends StatefulWidget {
  const AttendanceFormScreen({super.key});

  @override
  State<AttendanceFormScreen> createState() => _AttendanceFormScreenState();
}

class _AttendanceFormScreenState extends State<AttendanceFormScreen> {
  final _authService = AuthService();
  final _firestoreService = FirestoreService();

  bool _isLoading = true;
  bool _isNoClassDay = false;
  String? _noClassReason;

  List<Schedule> _todaySchedules = [];
  Map<String, Instructor> _instructorMap = {};
  Map<String, Room> _roomMap = {};

  
  
  Map<String, String> _checkedStatus = {};
  
  Map<String, String> _checkedByKey = {};
  
  Map<String, int> _checkedCounts = {};

  StreamSubscription<QuerySnapshot>? _noClassSubscription;

  @override
  void initState() {
    super.initState();
    _loadData();
    _noClassSubscription = _firestoreService.getNoClassDatesStream().listen((_) {
      _checkNoClassDay();
    });
  }

  @override
  void dispose() {
    _noClassSubscription?.cancel();
    super.dispose();
  }

  void _loadData() {
    setState(() => _isLoading = true);
    _checkNoClassDay();

    _firestoreService.getInstructors().listen((instructors) {
      if (mounted) {
        setState(() {
          _instructorMap = {for (var i in instructors) i.id: i};
        });
        _loadTodaySchedules();
      }
    });

    _firestoreService.getRooms().listen((rooms) {
      if (mounted) {
        setState(() {
          _roomMap = {for (var r in rooms) r.id: r};
        });
        _loadTodaySchedules();
      }
    });

    _loadTodayAttendance();
  }

  void _loadTodayAttendance() {
    final checkerId = _authService.currentUser?.uid ?? '';
    if (checkerId.isEmpty) return;

    _firestoreService.getTodayRecords(checkerId).listen((records) {
      if (mounted) {
        final Map<String, String> byDisplay = {};
        final Map<String, String> byKey = {};
        final Map<String, int> submissionCounts = {};
        
        
        
        final reversedRecords = records.reversed.toList();
        
        for (var r in reversedRecords) {
          if (r.subjectSchedule != null && r.subjectSchedule!.isNotEmpty) {
            byDisplay[r.subjectSchedule!] = r.status;
            submissionCounts[r.subjectSchedule!] = (submissionCounts[r.subjectSchedule!] ?? 0) + 1;
          }
          final key = 'inst_${r.instructorId}_${r.roomId}';
          byKey[key] = r.status;
          submissionCounts[key] = (submissionCounts[key] ?? 0) + 1;
        }
        setState(() {
          _checkedStatus = byDisplay;
          _checkedByKey = byKey;
          _checkedCounts = submissionCounts;
        });
      }
    });
  }

  Future<void> _checkNoClassDay() async {
    final reason = await _firestoreService.getNoClassReason(DateTime.now());
    if (mounted) {
      setState(() {
        _isNoClassDay = reason != null;
        _noClassReason = reason;
      });
    }
  }

  void _loadTodaySchedules() {
    final now = DateTime.now();
    final today = DateFormat('EEEE').format(now);

    _firestoreService.getSchedules(dayOfWeek: today).listen((schedules) {
      if (mounted) {
        setState(() {
          _todaySchedules = schedules;
          _isLoading = false;
        });
      }
    });
  }

  
  bool _isActiveNow(Schedule s) {
    final now = TimeOfDay.fromDateTime(DateTime.now());
    final start = _parseTime(s.startTime);
    final end = _parseTime(s.endTime);
    if (start == null || end == null) return false;
    final nowMin = now.hour * 60 + now.minute;
    final startMin = start.hour * 60 + start.minute;
    final endMin = end.hour * 60 + end.minute;
    return nowMin >= startMin && nowMin <= endMin;
  }

  TimeOfDay? _parseTime(String time) {
    try {
      final parts = time.split(':');
      return TimeOfDay(hour: int.parse(parts[0]), minute: int.parse(parts[1]));
    } catch (_) {
      return null;
    }
  }

  
  String _formatTime12(String t) {
    final parts = t.split(':');
    if (parts.length != 2) return t;
    final h = int.tryParse(parts[0]) ?? 0;
    final m = int.tryParse(parts[1]) ?? 0;
    final suffix = h >= 12 ? 'PM' : 'AM';
    final h12 = h % 12 == 0 ? 12 : h % 12;
    return '$h12:${m.toString().padLeft(2, '0')} $suffix';
  }

  
  String? _getStatus(Schedule schedule) {
    if (_checkedStatus.containsKey(schedule.displayText)) {
      return _checkedStatus[schedule.displayText];
    }
    final key = 'inst_${schedule.instructorId}_${schedule.roomId}';
    if (_checkedByKey.containsKey(key)) {
      return _checkedByKey[key];
    }
    return null;
  }

  Color _statusColor(String? status) {
    switch (status) {
      case 'Present':
        return AppColors.present;
      case 'Present (Not Teaching)':
        return AppColors.notTeaching;
      case 'Late':
        return AppColors.late;
      case 'Absent':
        return AppColors.absent;
      default:
        return Colors.red; 
    }
  }

  IconData _statusIcon(String? status) {
    switch (status) {
      case 'Present':
        return Icons.check_circle;
      case 'Present (Not Teaching)':
        return Icons.person_outline;
      case 'Late':
        return Icons.access_time_filled;
      case 'Absent':
        return Icons.cancel;
      default:
        return Icons.radio_button_unchecked;
    }
  }

  void _handleScheduleTap(Schedule schedule) async {
    final currentStatus = _getStatus(schedule);
    
    
    final changeCount = _checkedCounts[schedule.displayText] ?? 0;
    if (changeCount >= 3) {
      showDialog(
        context: context,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: Text(
            'Change Limit Reached',
            style: GoogleFonts.poppins(fontWeight: FontWeight.bold, color: AppColors.error),
          ),
          content: Text(
            'You have already modified the attendance status for this class 3 times today. No more corrections are allowed for this schedule.',
            style: GoogleFonts.poppins(fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: Text('OK', style: GoogleFonts.poppins(color: AppColors.primary, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      );
      return;
    }

    if (currentStatus != null) {
      
      final proceed = await showDialog<bool>(
        context: context,
        builder: (context) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          title: Text(
            'Confirm Correction',
            style: GoogleFonts.poppins(fontWeight: FontWeight.bold),
          ),
          content: Text(
            'This class has already been marked as "$currentStatus". Do you want to correct or update this status?\n\nCorrections will be logged and notified to the Admin.',
            style: GoogleFonts.poppins(fontSize: 13),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context, false),
              child: Text('Cancel', style: GoogleFonts.poppins(color: Colors.grey)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(context, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.primary,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
              child: Text('Proceed', style: GoogleFonts.poppins(color: Colors.white)),
            ),
          ],
        ),
      );

      if (proceed != true) return;
    }

    _showStatusDialog(schedule);
  }

  Future<String?> _showCorrectionReasonDialog(String oldStatus, String newStatus) async {
    final controller = TextEditingController();
    return showDialog<String>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Reason for Correction',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 16),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Changing status from "$oldStatus" to "$newStatus". Please specify the reason for this correction:',
              style: GoogleFonts.poppins(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              decoration: InputDecoration(
                hintText: 'e.g., Mistakenly pressed Present earlier',
                hintStyle: GoogleFonts.poppins(fontSize: 12, color: Colors.grey),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              style: GoogleFonts.poppins(fontSize: 13),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, null),
            child: Text('Cancel', style: GoogleFonts.poppins(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              final text = controller.text.trim();
              if (text.isEmpty) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('Please enter a reason for the correction.')),
                );
                return;
              }
              Navigator.pop(ctx, text);
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: Text('Submit', style: GoogleFonts.poppins(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  
  Future<void> _showStatusDialog(Schedule schedule) async {
    final instructor = _instructorMap[schedule.instructorId];
    final room = _roomMap[schedule.roomId];

    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          instructor?.name ?? 'Unknown Instructor',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 18),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              '${schedule.subject}${schedule.course != null && schedule.course!.isNotEmpty ? " (${schedule.course})" : ""}  •  ${room?.name ?? "Unknown"}',
              style: GoogleFonts.poppins(fontSize: 14, color: AppColors.textSecondary),
            ),
            Text(
              '${_formatTime12(schedule.startTime)} - ${_formatTime12(schedule.endTime)}',
              style: GoogleFonts.poppins(fontSize: 13, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),
            Text('Select Status:', style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500)),
            const SizedBox(height: 12),
            _dialogBtn(ctx, 'Present', Icons.check_circle, AppColors.present),
            const SizedBox(height: 8),
            _dialogBtn(ctx, 'Present (Not Teaching)', Icons.person_outline, AppColors.notTeaching),
            const SizedBox(height: 8),
            _dialogBtn(ctx, 'Late', Icons.access_time, AppColors.late),
            const SizedBox(height: 8),
            _dialogBtn(ctx, 'Absent', Icons.cancel, AppColors.absent),
          ],
        ),
      ),
    );

    if (result != null) {
      final oldStatus = _getStatus(schedule);
      if (oldStatus != null && oldStatus != result) {
        final correctionReason = await _showCorrectionReasonDialog(oldStatus, result);
        if (correctionReason != null) {
          await _submitAttendance(
            schedule,
            result,
            remarks: 'Correction: $correctionReason',
            oldStatus: oldStatus,
          );
        }
      } else if (result == 'Present (Not Teaching)') {
        
        final reason = await _showReasonPicker();
        if (reason != null && reason.isNotEmpty) {
          await _submitAttendance(schedule, result, remarks: reason);
        }
      } else {
        await _submitAttendance(schedule, result);
      }
    }
  }

  
  static const List<String> _presetReasons = [
    'Faculty Meeting',
    'Administrative Work',
    'Seminar / Training',
    'Student Consultation',
    'On Official Business',
    'No Students / Class Suspended',
    'Room Unavailable',
    'Exam Preparation',
    'Department Meeting',
    'Research / Thesis Advising',
    'Community Extension',
    'On Leave (Half Day)',
  ];

  
  Future<String?> _showReasonPicker() async {
    final customController = TextEditingController();

    return showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          'Reason for Not Teaching',
          style: GoogleFonts.poppins(fontWeight: FontWeight.w600, fontSize: 16),
        ),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Select a reason or type your own:',
                style: GoogleFonts.poppins(fontSize: 13, color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              
              SizedBox(
                height: 250,
                child: ListView.separated(
                  shrinkWrap: true,
                  itemCount: _presetReasons.length,
                  separatorBuilder: (_, __) => const Divider(height: 1),
                  itemBuilder: (context, index) {
                    final reason = _presetReasons[index];
                    return ListTile(
                      dense: true,
                      contentPadding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      leading: Icon(Icons.arrow_right_rounded, color: AppColors.notTeaching, size: 22),
                      title: Text(
                        reason,
                        style: GoogleFonts.poppins(fontSize: 13, fontWeight: FontWeight.w500),
                      ),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      hoverColor: AppColors.notTeaching.withOpacity(0.08),
                      onTap: () => Navigator.pop(ctx, reason),
                    );
                  },
                ),
              ),
              const Divider(),
              const SizedBox(height: 8),
              
              TextField(
                controller: customController,
                decoration: InputDecoration(
                  hintText: 'Or type a custom reason...',
                  hintStyle: GoogleFonts.poppins(fontSize: 13),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(10),
                  ),
                  contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  suffixIcon: IconButton(
                    icon: Icon(Icons.send_rounded, color: AppColors.notTeaching),
                    onPressed: () {
                      final text = customController.text.trim();
                      if (text.isNotEmpty) Navigator.pop(ctx, text);
                    },
                  ),
                ),
                onSubmitted: (text) {
                  if (text.trim().isNotEmpty) Navigator.pop(ctx, text.trim());
                },
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, null),
            child: Text('Cancel', style: GoogleFonts.poppins(color: Colors.grey)),
          ),
        ],
      ),
    );
  }

  Widget _dialogBtn(BuildContext ctx, String label, IconData icon, Color color) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton.icon(
        onPressed: () => Navigator.pop(ctx, label),
        icon: Icon(icon),
        label: Text(label),
        style: ElevatedButton.styleFrom(
          backgroundColor: color,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        ),
      ),
    );
  }

  Future<void> _submitAttendance(Schedule schedule, String status, {String? remarks, String? oldStatus}) async {
    try {
      final checkerName = await _authService.getUserFullName();
      final checkerId = _authService.currentUser?.uid ?? '';
      final instructor = _instructorMap[schedule.instructorId];
      final room = _roomMap[schedule.roomId];

      final record = AttendanceRecord(
        instructorId: schedule.instructorId,
        instructorName: instructor?.name ?? 'Unknown',
        roomId: schedule.roomId,
        roomName: room?.name ?? 'Unknown',
        subjectSchedule: schedule.displayText,
        status: status,
        remarks: remarks,
        dateTime: DateTime.now(),
        checkerId: checkerId,
        checkerName: checkerName,
      );

      final synced = await _firestoreService.submitAttendance(record);

      if (oldStatus != null && oldStatus != status) {
        await _firestoreService.createCorrectionNotification(
          checkerName: checkerName,
          instructorName: instructor?.name ?? 'Unknown',
          subject: schedule.subject,
          oldStatus: oldStatus,
          newStatus: status,
          reason: remarks?.replaceAll('Correction: ', '') ?? 'No reason provided',
        );
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              synced
                  ? '${instructor?.name ?? "Instructor"} marked as $status!'
                  : 'Saved offline. Will sync when connected.',
            ),
            backgroundColor: synced ? AppColors.success : AppColors.warning,
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final formattedDate = DateFormat('EEEE, MMMM d, yyyy').format(now);
    final formattedTime = DateFormat('hh:mm a').format(now);

    final activeSchedules = _todaySchedules.where((s) => _isActiveNow(s)).toList();
    final otherSchedules = _todaySchedules.where((s) => !_isActiveNow(s)).toList();

    return Scaffold(
      appBar: AppBar(
        title: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Image.asset(
              'assets/images/spct-logo.png',
              height: 28,
              errorBuilder: (context, error, stackTrace) => const SizedBox.shrink(),
            ),
            const SizedBox(width: 8),
            Text(
              'Attendance Check',
              style: GoogleFonts.poppins(
                fontWeight: FontWeight.w600,
                fontSize: 18,
              ),
            ),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: () async => _loadData(),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withOpacity(0.05),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.calendar_today, color: AppColors.primary, size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(formattedDate,
                                style: GoogleFonts.poppins(fontSize: 14, fontWeight: FontWeight.w500)),
                          ),
                          const Icon(Icons.access_time, color: AppColors.primary, size: 20),
                          const SizedBox(width: 4),
                          Text(formattedTime,
                              style: GoogleFonts.poppins(
                                  fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primary)),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),

                    
                    if (_isNoClassDay) ...[
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.red.shade50,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: Colors.red.shade200),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.event_busy, color: Colors.red.shade700, size: 24),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text('No Class Today',
                                      style: GoogleFonts.poppins(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.red.shade700)),
                                  Text(_noClassReason ?? '',
                                      style: GoogleFonts.poppins(
                                          fontSize: 12, color: Colors.red.shade600)),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 20),
                    ],

                    
                    if (activeSchedules.isNotEmpty) ...[
                      _sectionHeader('Active Now', AppColors.present, true),
                      const SizedBox(height: 10),
                      _buildTable(activeSchedules, isActive: true),
                      const SizedBox(height: 24),
                    ],

                    
                    if (_todaySchedules.isEmpty) _emptyState(),

                    
                    if (activeSchedules.isEmpty && otherSchedules.isNotEmpty) ...[
                      _infoBar('No classes active right now. See today\'s schedules below.'),
                      const SizedBox(height: 20),
                    ],

                    
                    if (otherSchedules.isNotEmpty) ...[
                      _sectionHeader(
                        activeSchedules.isNotEmpty ? 'Other Schedules Today' : "Today's Schedules",
                        AppColors.textSecondary,
                        false,
                      ),
                      const SizedBox(height: 10),
                      _buildTable(otherSchedules, isActive: false),
                    ],
                  ],
                ),
              ),
            ),
    );
  }

  
  Widget _sectionHeader(String text, Color color, bool showDot) {
    return Row(
      children: [
        if (showDot) ...[
          Container(
            width: 10,
            height: 10,
            decoration: BoxDecoration(color: color, shape: BoxShape.circle),
          ),
          const SizedBox(width: 8),
        ],
        Text(text,
            style: GoogleFonts.poppins(
                fontSize: 16, fontWeight: FontWeight.w700, color: color)),
      ],
    );
  }

  
  Widget _emptyState() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(40),
      decoration: BoxDecoration(
        color: Colors.grey.shade50,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.shade200),
      ),
      child: Column(
        children: [
          Icon(Icons.event_busy, size: 64, color: Colors.grey.shade400),
          const SizedBox(height: 16),
          Text('No Classes Today',
              style: GoogleFonts.poppins(fontSize: 18, fontWeight: FontWeight.w600)),
          const SizedBox(height: 8),
          Text('No schedules found for today.',
              style: GoogleFonts.poppins(fontSize: 13, color: AppColors.textSecondary)),
        ],
      ),
    );
  }

  
  Widget _infoBar(String msg) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.warning.withOpacity(0.06),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withOpacity(0.3)),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: AppColors.warning),
          const SizedBox(width: 12),
          Expanded(child: Text(msg,
              style: GoogleFonts.poppins(fontSize: 13, color: AppColors.textSecondary))),
        ],
      ),
    );
  }

  
  Widget _buildTable(List<Schedule> schedules, {required bool isActive}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        boxShadow: [
          BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 10, offset: const Offset(0, 2)),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: Column(
          children: [
            
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              color: isActive ? AppColors.primary.withOpacity(0.08) : Colors.grey.shade50,
              child: Row(
                children: [
                  _headerCell('INSTRUCTOR', 3),
                  _headerCell('ROOM', 2),
                  _headerCell('SCHEDULE', 2),
                  SizedBox(
                    width: 80,
                    child: Text('STATUS',
                        textAlign: TextAlign.center,
                        style: _headerStyle()),
                  ),
                ],
              ),
            ),
            
            ...schedules.asMap().entries.map((entry) {
              final idx = entry.key;
              final schedule = entry.value;
              return _buildRow(schedule, idx, isActive);
            }),
          ],
        ),
      ),
    );
  }

  Widget _headerCell(String text, int flex) {
    return Expanded(
      flex: flex,
      child: Text(text, style: _headerStyle()),
    );
  }

  TextStyle _headerStyle() => GoogleFonts.poppins(
        fontSize: 11,
        fontWeight: FontWeight.w700,
        color: AppColors.textSecondary,
        letterSpacing: 0.5,
      );

  
  Widget _buildRow(Schedule schedule, int idx, bool isActive) {
    final instructor = _instructorMap[schedule.instructorId];
    final room = _roomMap[schedule.roomId];
    final status = _getStatus(schedule);
    final color = _statusColor(status);
    final isChecked = status != null;

    return Container(
      decoration: BoxDecoration(
        color: idx.isEven ? Colors.white : Colors.grey.shade50,
        border: Border(bottom: BorderSide(color: Colors.grey.shade200, width: 0.5)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isActive ? () => _handleScheduleTap(schedule) : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
            child: Row(
              children: [
                
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(instructor?.name ?? 'Unknown',
                          style: GoogleFonts.poppins(
                              fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary)),
                      Text(
                          '${schedule.subject}${schedule.course != null && schedule.course!.isNotEmpty ? " (${schedule.course})" : ""}',
                          style: GoogleFonts.poppins(fontSize: 11, color: AppColors.textSecondary)),
                    ],
                  ),
                ),
                
                Expanded(
                  flex: 2,
                  child: Text(room?.name ?? 'Unknown',
                      style: GoogleFonts.poppins(fontSize: 13, color: AppColors.textPrimary)),
                ),
                
                Expanded(
                  flex: 2,
                  child: Text('${_formatTime12(schedule.startTime)}-${_formatTime12(schedule.endTime)}',
                      style: GoogleFonts.poppins(fontSize: 12, color: AppColors.textSecondary)),
                ),
                
                SizedBox(
                  width: 80,
                  child: isActive
                      ? GestureDetector(
                          onTap: () => _handleScheduleTap(schedule),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 6),
                            decoration: BoxDecoration(
                              color: color.withOpacity(0.15),
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: color, width: 1.5),
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(_statusIcon(status), size: 14, color: color),
                                const SizedBox(width: 3),
                                Flexible(
                                  child: Text(
                                    isChecked ? status! : 'Check',
                                    style: GoogleFonts.poppins(
                                        fontSize: 11, fontWeight: FontWeight.w600, color: color),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        )
                      : Center(
                          child: Text('—',
                              style: GoogleFonts.poppins(fontSize: 14, color: Colors.grey.shade400)),
                        ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
