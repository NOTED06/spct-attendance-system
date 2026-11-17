import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;

  
  User? get currentUser => _auth.currentUser;

  
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  
  
  Future<UserCredential?> signIn({
    required String email,
    required String password,
  }) async {
    try {
      return await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
    } on FirebaseAuthException catch (e) {
      throw _handleAuthError(e);
    }
  }

  
  Future<String> getUserRole() async {
    final user = currentUser;
    if (user == null) return '';
    
    try {
      final doc = await _firestore
          .collection('users')
          .doc(user.uid)
          .get();

      if (doc.exists) {
        return doc.data()?['role'] ?? 'checker';
      }
    } catch (_) {}
    return 'checker';
  }

  
  Future<String> getUserFullName() async {
    final user = currentUser;
    if (user == null) return '';

    try {
      final doc = await _firestore
          .collection('users')
          .doc(user.uid)
          .get();

      if (doc.exists) {
        return doc.data()?['fullName'] ?? user.displayName ?? '';
      }
      return user.displayName ?? '';
    } catch (_) {
      return user.displayName ?? '';
    }
  }

  
  
  Future<String> validateChecker() async {
    final user = currentUser;
    if (user == null) return 'Not signed in.';

    try {
      final doc = await _firestore
          .collection('users')
          .doc(user.uid)
          .get();

      if (!doc.exists) {
        return 'Account not found. Contact your administrator.';
      }
      final data = doc.data();
      if (data?['role'] != 'checker') {
        return 'This app is for checkers only. Use the admin panel instead.';
      }
      if (data?['isActive'] == false) {
        return 'Your account has been deactivated. Contact your administrator.';
      }
      return ''; 
    } catch (e) {
      return 'Error verifying account: $e';
    }
  }

  
  Future<void> signOut() async {
    await _auth.signOut();
  }

  
  Future<void> resetPassword(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email.trim());
    } on FirebaseAuthException catch (e) {
      throw _handleAuthError(e);
    }
  }

  
  String _handleAuthError(FirebaseAuthException e) {
    switch (e.code) {
      case 'user-not-found':
        return 'No account found with this email.';
      case 'wrong-password':
        return 'Incorrect password. Please try again.';
      case 'invalid-credential':
        return 'Incorrect email or password. Please try again.';
      case 'email-already-in-use':
        return 'An account already exists with this email.';
      case 'weak-password':
        return 'Password is too weak. Use at least 6 characters.';
      case 'invalid-email':
        return 'Please enter a valid email address.';
      case 'too-many-requests':
        return 'Too many attempts. Please try again later.';
      case 'user-disabled':
        return 'This account has been disabled. Contact admin.';
      default:
        return 'Authentication error: ${e.message}';
    }
  }
}
