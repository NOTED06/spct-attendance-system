import 'package:cloud_firestore/cloud_firestore.dart';

class Room {
  final String id;
  final String name;
  final String building;
  final bool isActive;

  Room({
    required this.id,
    required this.name,
    required this.building,
    this.isActive = true,
  });

  
  Map<String, dynamic> toMap() {
    return {
      'name': name,
      'building': building,
      'isActive': isActive,
    };
  }

  
  factory Room.fromFirestore(DocumentSnapshot doc) {
    final data = doc.data() as Map<String, dynamic>;
    return Room(
      id: doc.id,
      name: data['name'] ?? '',
      building: data['building'] ?? '',
      isActive: data['isActive'] ?? true,
    );
  }

  @override
  String toString() => '$name ($building)';

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Room && runtimeType == other.runtimeType && id == other.id;

  @override
  int get hashCode => id.hashCode;
}
