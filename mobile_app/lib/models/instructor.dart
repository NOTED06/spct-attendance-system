import 'package:cloud_firestore/cloud_firestore.dart';

class Instructor {
  final String id;
  final String name;
  final String department;
  final String? email;
  final String employmentType; 
  final bool isActive;

  Instructor({
    required this.id,
    required this.name,
    required this.department,
    this.email,
    this.employmentType = 'Full-time',
    this.isActive = true,
  });

  
  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'department': department,
      'email': email ?? '',
      'employmentType': employmentType,
      'isActive': isActive,
    };
  }

  
  factory Instructor.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Instructor(
      id: doc.id,
      name: data['name'] ?? '',
      department: data['department'] ?? '',
      email: data['email'],
      employmentType: data['employmentType'] ?? 'Full-time',
      isActive: data['isActive'] ?? true,
    );
  }

  @override
  String toString() => name;

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Instructor &&
          runtimeType == other.runtimeType &&
          id == other.id;

  @override
  int get hashCode => id.hashCode;
}
