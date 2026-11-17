import 'package:cloud_firestore/cloud_firestore.dart';

class AttendanceRecord {
  final String? id;
  final String instructorId;
  final String instructorName;
  final String roomId;
  final String roomName;
  final String? subjectSchedule;
  final String status; 
  final String? remarks; 
  final DateTime dateTime;
  final String checkerId;
  final String checkerName;
  final bool isSynced;

  AttendanceRecord({
    this.id,
    required this.instructorId,
    required this.instructorName,
    required this.roomId,
    required this.roomName,
    this.subjectSchedule,
    required this.status,
    this.remarks,
    required this.dateTime,
    required this.checkerId,
    required this.checkerName,
    this.isSynced = true,
  });

  
  Map<String, dynamic> toMap() {
    return {
      'instructorId': instructorId,
      'instructorName': instructorName,
      'roomId': roomId,
      'roomName': roomName,
      'subjectSchedule': subjectSchedule ?? '',
      'status': status,
      'remarks': remarks ?? '',
      'dateTime': Timestamp.fromDate(dateTime),
      'checkerId': checkerId,
      'checkerName': checkerName,
    };
  }

  
  factory AttendanceRecord.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return AttendanceRecord(
      id: doc.id,
      instructorId: data['instructorId'] ?? '',
      instructorName: data['instructorName'] ?? '',
      roomId: data['roomId'] ?? '',
      roomName: data['roomName'] ?? '',
      subjectSchedule: data['subjectSchedule'],
      status: data['status'] ?? 'Absent',
      remarks: data['remarks'],
      dateTime: (data['dateTime'] as Timestamp).toDate(),
      checkerId: data['checkerId'] ?? '',
      checkerName: data['checkerName'] ?? '',
      isSynced: true,
    );
  }

  
  factory AttendanceRecord.fromLocal(Map<String, dynamic> data) {
    return AttendanceRecord(
      id: data['id'],
      instructorId: data['instructorId'] ?? '',
      instructorName: data['instructorName'] ?? '',
      roomId: data['roomId'] ?? '',
      roomName: data['roomName'] ?? '',
      subjectSchedule: data['subjectSchedule'],
      status: data['status'] ?? 'Absent',
      remarks: data['remarks'],
      dateTime: DateTime.parse(data['dateTime']),
      checkerId: data['checkerId'] ?? '',
      checkerName: data['checkerName'] ?? '',
      isSynced: data['isSynced'] ?? false,
    );
  }

  
  Map<String, dynamic> toLocalMap() {
    return {
      'id': id,
      'instructorId': instructorId,
      'instructorName': instructorName,
      'roomId': roomId,
      'roomName': roomName,
      'subjectSchedule': subjectSchedule ?? '',
      'status': status,
      'remarks': remarks ?? '',
      'dateTime': dateTime.toIso8601String(),
      'checkerId': checkerId,
      'checkerName': checkerName,
      'isSynced': isSynced,
    };
  }

  
  static String statusLabel(String status) {
    switch (status) {
      case 'Present':
        return '✅ Present';
      case 'Present (Not Teaching)':
        return '🏢 Present (Not Teaching)';
      case 'Late':
        return '⏰ Late';
      case 'Absent':
        return '❌ Absent';
      default:
        return status;
    }
  }
}
