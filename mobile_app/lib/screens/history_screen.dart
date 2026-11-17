import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../services/auth_service.dart';
import '../services/firestore_service.dart';
import '../models/attendance_record.dart';
import '../widgets/common_widgets.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  final _authService = AuthService();
  final _firestoreService = FirestoreService();

  String _filterStatus = 'All';
  DateTime? _filterDate;
  final List<String> _statusFilters = ['All', 'Present', 'Present (Not Teaching)', 'Late', 'Absent'];

  @override
  Widget build(BuildContext context) {
    final checkerId = _authService.currentUser?.uid ?? '';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance History'),
        actions: [
          
          IconButton(
            onPressed: _pickDateFilter,
            icon: Icon(
              _filterDate != null
                  ? Icons.calendar_month
                  : Icons.calendar_today_outlined,
            ),
            tooltip: 'Filter by date',
          ),
          if (_filterDate != null || _filterStatus != 'All')
            IconButton(
              onPressed: () {
                setState(() {
                  _filterDate = null;
                  _filterStatus = 'All';
                });
              },
              icon: const Icon(Icons.clear_all),
              tooltip: 'Clear filters',
            ),
        ],
      ),
      body: Column(
        children: [
          
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _statusFilters.map((status) {
                  final isSelected = _filterStatus == status;
                  Color chipColor;

                  switch (status) {
                    case 'Present':
                      chipColor = AppColors.present;
                      break;
                    case 'Present (Not Teaching)':
                      chipColor = AppColors.notTeaching;
                      break;
                    case 'Late':
                      chipColor = AppColors.late;
                      break;
                    case 'Absent':
                      chipColor = AppColors.absent;
                      break;
                    default:
                      chipColor = AppColors.primary;
                  }

                  return Padding(
                    padding: const EdgeInsets.only(right: 8),
                    child: FilterChip(
                      label: Text(status),
                      selected: isSelected,
                      onSelected: (selected) {
                        setState(() {
                          _filterStatus = selected ? status : 'All';
                        });
                      },
                      selectedColor: chipColor.withOpacity(0.2),
                      checkmarkColor: chipColor,
                      labelStyle: TextStyle(
                        color: isSelected ? chipColor : AppColors.textSecondary,
                        fontWeight:
                            isSelected ? FontWeight.w600 : FontWeight.normal,
                      ),
                    ),
                  );
                }).toList(),
              ),
            ),
          ),

          
          if (_filterDate != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Row(
                children: [
                  const Icon(Icons.filter_list,
                      size: 16, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Text(
                    'Showing: ${DateFormat('MMMM d, yyyy').format(_filterDate!)}',
                    style: const TextStyle(
                      color: AppColors.primary,
                      fontWeight: FontWeight.w500,
                      fontSize: 13,
                    ),
                  ),
                ],
              ),
            ),

          const Divider(height: 1),

          
          Expanded(
            child: StreamBuilder<List<AttendanceRecord>>(
              stream: _firestoreService.getAttendanceRecords(
                status: _filterStatus == 'All' ? null : _filterStatus,
                startDate: _filterDate,
                endDate: _filterDate != null
                    ? _filterDate!.add(const Duration(days: 1))
                    : null,
              ),
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Center(child: CircularProgressIndicator());
                }

                if (snapshot.hasError) {
                  return Center(
                    child: Text('Error: ${snapshot.error}'),
                  );
                }

                final records = snapshot.data ?? [];

                if (records.isEmpty) {
                  return const EmptyStateWidget(
                    icon: Icons.history,
                    title: 'No records found',
                    subtitle: 'Try adjusting your filters',
                  );
                }

                
                final groupedRecords = <String, List<AttendanceRecord>>{};
                for (var record in records) {
                  final dateKey =
                      DateFormat('yyyy-MM-dd').format(record.dateTime);
                  groupedRecords.putIfAbsent(dateKey, () => []);
                  groupedRecords[dateKey]!.add(record);
                }

                final dateKeys = groupedRecords.keys.toList()..sort((a, b) => b.compareTo(a));

                return ListView.builder(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  itemCount: dateKeys.length,
                  itemBuilder: (context, index) {
                    final dateKey = dateKeys[index];
                    final dayRecords = groupedRecords[dateKey]!;
                    final date = DateTime.parse(dateKey);

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        
                        Padding(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 16, vertical: 8),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: AppColors.primary.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(20),
                                ),
                                child: Text(
                                  DateFormat('EEEE, MMM d').format(date),
                                  style: GoogleFonts.poppins(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                '${dayRecords.length} record(s)',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: Colors.grey.shade500,
                                ),
                              ),
                            ],
                          ),
                        ),

                        
                        ...dayRecords
                            .map((record) => _buildRecordCard(record)),
                      ],
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRecordCard(AttendanceRecord record) {
    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            
            CircleAvatar(
              backgroundColor: AppColors.primary.withOpacity(0.1),
              radius: 24,
              child: Text(
                record.instructorName.isNotEmpty
                    ? record.instructorName[0].toUpperCase()
                    : '?',
                style: const TextStyle(
                  color: AppColors.primary,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
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
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 15,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(Icons.room,
                          size: 14, color: Colors.grey.shade500),
                      const SizedBox(width: 4),
                      Text(
                        record.roomName,
                        style: TextStyle(
                          fontSize: 12,
                          color: Colors.grey.shade600,
                        ),
                      ),
                    ],
                  ),
                  if (record.subjectSchedule != null &&
                      record.subjectSchedule!.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Icon(Icons.book,
                            size: 14, color: Colors.grey.shade500),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            record.subjectSchedule!,
                            style: TextStyle(
                              fontSize: 12,
                              color: Colors.grey.shade600,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: 2),
                  Text(
                    DateFormat('hh:mm a').format(record.dateTime),
                    style: TextStyle(
                      fontSize: 12,
                      color: Colors.grey.shade500,
                    ),
                  ),
                  if (record.remarks != null && record.remarks!.isNotEmpty) ...[                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.info_outline, size: 13, color: AppColors.notTeaching),
                        const SizedBox(width: 4),
                        Flexible(
                          child: Text(
                            record.remarks!,
                            style: TextStyle(
                              fontSize: 11,
                              fontStyle: FontStyle.italic,
                              color: AppColors.notTeaching,
                            ),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),

            
            StatusChip(status: record.status),
          ],
        ),
      ),
    );
  }

  Future<void> _pickDateFilter() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _filterDate ?? DateTime.now(),
      firstDate: DateTime(2024),
      lastDate: DateTime.now(),
    );

    if (picked != null) {
      setState(() => _filterDate = picked);
    }
  }
}
