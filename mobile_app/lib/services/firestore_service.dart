import 'dart:convert';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:connectivity_plus/connectivity_plus.dart';
import '../models/attendance_record.dart';
import '../models/instructor.dart';
import '../models/room.dart';
import '../models/schedule.dart';

class FirestoreService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  static const String _offlineKey = 'offline_attendance_records';

  

  
  
  Future<bool> submitAttendance(AttendanceRecord record) async {
    final isOnline = await _checkConnectivity();

    if (isOnline) {
      try {
        await _firestore.collection('attendance').add(record.toMap());
        return true;
      } catch (e) {
        
        await _saveRecordLocally(record);
        return false;
      }
    } else {
      
      await _saveRecordLocally(record);
      return false;
    }
  }

  
  Future<void> createCorrectionNotification({
    required String checkerName,
    required String instructorName,
    required String subject,
    required String oldStatus,
    required String newStatus,
    required String reason,
  }) async {
    try {
      await _firestore.collection('notifications').add({
        'title': 'Attendance Correction',
        'message': '$checkerName corrected $instructorName ($subject) from $oldStatus to $newStatus. Reason: $reason',
        'timestamp': DateTime.now(),
        'type': 'correction',
        'read': false,
      });
    } catch (e) {
      print('Error creating notification: $e');
    }
  }

  
  Stream<List<AttendanceRecord>> getAttendanceRecords({
    String? instructorId,
    DateTime? startDate,
    DateTime? endDate,
    String? status,
  }) {
    
    
    return _firestore
        .collection('attendance')
        .snapshots()
        .map((snapshot) {
      var list = snapshot.docs
          .map((doc) => AttendanceRecord.fromFirestore(doc))
          .toList();

      if (instructorId != null && instructorId.isNotEmpty) {
        list = list.where((r) => r.instructorId == instructorId).toList();
      }
      if (status != null && status.isNotEmpty) {
        list = list.where((r) => r.status == status).toList();
      }
      if (startDate != null) {
        list = list.where((r) => r.dateTime.isAfter(
            startDate.subtract(const Duration(seconds: 1)))).toList();
      }
      if (endDate != null) {
        list = list.where((r) => r.dateTime.isBefore(
            endDate.add(const Duration(seconds: 1)))).toList();
      }

      list.sort((a, b) => b.dateTime.compareTo(a.dateTime));
      return list;
    });
  }

  
  Stream<List<AttendanceRecord>> getTodayRecords(String checkerId) {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    
    
    return _firestore
        .collection('attendance')
        .where('checkerId', isEqualTo: checkerId)
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs
          .map((doc) => AttendanceRecord.fromFirestore(doc))
          .where((r) =>
              r.dateTime.isAfter(startOfDay.subtract(const Duration(seconds: 1))) &&
              r.dateTime.isBefore(endOfDay))
          .toList();
      list.sort((a, b) => b.dateTime.compareTo(a.dateTime));
      return list;
    });
  }

  
  Future<Map<String, int>> getTodaySummary(String checkerId) async {
    final now = DateTime.now();
    final startOfDay = DateTime(now.year, now.month, now.day);
    final endOfDay = startOfDay.add(const Duration(days: 1));

    
    final snapshot = await _firestore
        .collection('attendance')
        .where('checkerId', isEqualTo: checkerId)
        .get();

    int present = 0, notTeaching = 0, late = 0, absent = 0, total = 0;
    for (var doc in snapshot.docs) {
      final data = doc.data();
      final ts = data['dateTime'] as Timestamp?;
      if (ts == null) continue;
      final dt = ts.toDate();
      
      if (dt.isBefore(startOfDay) || dt.isAfter(endOfDay)) continue;

      total++;
      final status = data['status'] as String;
      switch (status) {
        case 'Present':
          present++;
          break;
        case 'Present (Not Teaching)':
          notTeaching++;
          break;
        case 'Late':
          late++;
          break;
        case 'Absent':
          absent++;
          break;
      }
    }

    return {
      'total': total,
      'present': present,
      'notTeaching': notTeaching,
      'late': late,
      'absent': absent,
    };
  }

  

  
  Stream<List<Instructor>> getInstructors() {
    return _firestore
        .collection('instructors')
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs
          .map((doc) => Instructor.fromFirestore(doc))
          .where((i) => i.isActive)
          .toList();
      list.sort((a, b) => a.name.compareTo(b.name));
      return list;
    });
  }

  
  Future<Instructor?> getInstructor(String id) async {
    final doc = await _firestore.collection('instructors').doc(id).get();
    if (doc.exists) {
      return Instructor.fromFirestore(doc);
    }
    return null;
  }

  

  
  Stream<List<Room>> getRooms() {
    return _firestore
        .collection('rooms')
        .snapshots()
        .map((snapshot) {
      final list = snapshot.docs
          .map((doc) => Room.fromFirestore(doc))
          .where((r) => r.isActive)
          .toList();
      list.sort((a, b) => a.name.compareTo(b.name));
      return list;
    });
  }

  

  
  Stream<List<Schedule>> getSchedules({
    String? instructorId,
    String? roomId,
    String? dayOfWeek,
  }) {
    return _firestore
        .collection('schedules')
        .snapshots()
        .map((snapshot) {
      var list = snapshot.docs
          .map((doc) => Schedule.fromFirestore(doc))
          .where((s) => s.isActive)
          .toList();

      if (instructorId != null && instructorId.isNotEmpty) {
        list = list.where((s) => s.instructorId == instructorId).toList();
      }
      if (roomId != null && roomId.isNotEmpty) {
        list = list.where((s) => s.roomId == roomId).toList();
      }
      if (dayOfWeek != null && dayOfWeek.isNotEmpty) {
        list = list.where((s) => s.dayOfWeek == dayOfWeek || s.dayOfWeek == 'Everyday').toList();
      }

      return list;
    });
  }

  

  
  
  Future<String?> getNoClassReason(DateTime date) async {
    final dayStart = DateTime(date.year, date.month, date.day);
    final dayEnd = dayStart.add(const Duration(days: 1));

    try {
      
      final snapshot = await _firestore
          .collection('noClassDates')
          .where('date', isLessThan: Timestamp.fromDate(dayEnd))
          .get();

      for (var doc in snapshot.docs) {
        final data = doc.data();
        final startTs = data['date'] as Timestamp?;
        if (startTs == null) continue;
        final start = DateTime(startTs.toDate().year, startTs.toDate().month, startTs.toDate().day);

        DateTime end;
        if (data['endDate'] != null) {
          final endTs = data['endDate'] as Timestamp;
          end = DateTime(endTs.toDate().year, endTs.toDate().month, endTs.toDate().day);
        } else {
          end = start;
        }

        if (!dayStart.isBefore(start) && !dayStart.isAfter(end)) {
          return data['reason'] as String? ?? 'No Class';
        }
      }
      return null;
    } catch (e) {
      
      return null;
    }
  }

  
  Stream<QuerySnapshot> getNoClassDatesStream() {
    return _firestore.collection('noClassDates').snapshots();
  }

  

  
  Future<void> _saveRecordLocally(AttendanceRecord record) async {
    final prefs = await SharedPreferences.getInstance();
    final existingData = prefs.getString(_offlineKey);
    final List<Map<String, dynamic>> records = existingData != null
        ? List<Map<String, dynamic>>.from(jsonDecode(existingData))
        : [];

    records.add(record.toLocalMap());
    await prefs.setString(_offlineKey, jsonEncode(records));
  }

  
  Future<List<AttendanceRecord>> getOfflineRecords() async {
    final prefs = await SharedPreferences.getInstance();
    final data = prefs.getString(_offlineKey);
    if (data == null) return [];

    final List<Map<String, dynamic>> records =
        List<Map<String, dynamic>>.from(jsonDecode(data));
    return records.map((r) => AttendanceRecord.fromLocal(r)).toList();
  }

  
  Future<int> syncOfflineRecords() async {
    final isOnline = await _checkConnectivity();
    if (!isOnline) return 0;

    final records = await getOfflineRecords();
    if (records.isEmpty) return 0;

    int synced = 0;
    final failedRecords = <Map<String, dynamic>>[];

    for (var record in records) {
      try {
        await _firestore.collection('attendance').add(record.toMap());
        synced++;
      } catch (e) {
        failedRecords.add(record.toLocalMap());
      }
    }

    
    final prefs = await SharedPreferences.getInstance();
    if (failedRecords.isEmpty) {
      await prefs.remove(_offlineKey);
    } else {
      await prefs.setString(_offlineKey, jsonEncode(failedRecords));
    }

    return synced;
  }

  
  Future<int> getOfflineRecordCount() async {
    final records = await getOfflineRecords();
    return records.length;
  }

  
  Future<bool> _checkConnectivity() async {
    if (kIsWeb) return true; 
    try {
      final result = await Connectivity().checkConnectivity();
      return !result.contains(ConnectivityResult.none);
    } catch (_) {
      return true;
    }
  }
}
