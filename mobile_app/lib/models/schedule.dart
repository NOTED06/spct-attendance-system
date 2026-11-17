import 'package:cloud_firestore/cloud_firestore.dart';

class Schedule {
  final String id;
  final String instructorId;
  final String roomId;
  final String subject;
  final String? course; 
  final String dayOfWeek; 
  final String startTime; 
  final String endTime; 
  final bool isActive;

  Schedule({
    required this.id,
    required this.instructorId,
    required this.roomId,
    required this.subject,
    this.course,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.isActive = true,
  });

  
  Map<String, dynamic> toMap() {
    return {
      'instructorId': instructorId,
      'roomId': roomId,
      'subject': subject,
      'course': course ?? '',
      'dayOfWeek': dayOfWeek,
      'startTime': startTime,
      'endTime': endTime,
      'isActive': isActive,
    };
  }

  
  factory Schedule.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Schedule(
      id: doc.id,
      instructorId: data['instructorId'] ?? '',
      roomId: data['roomId'] ?? '',
      subject: data['subject'] ?? '',
      course: data['course'],
      dayOfWeek: data['dayOfWeek'] ?? '',
      startTime: data['startTime'] ?? '',
      endTime: data['endTime'] ?? '',
      isActive: data['isActive'] ?? true,
    );
  }

  
  String get displayText =>
      '$subject${course != null && course!.isNotEmpty ? " ($course)" : ""} ($dayOfWeek $startTime - $endTime)';

  @override
  String toString() => displayText;
}
