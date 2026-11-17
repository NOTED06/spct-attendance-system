import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      default:
        return android; 
    }
  }

  
  
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'YOUR_GOOGLE_API_KEY',
    appId: '1:205434543166:web:354b4a7e202b3ad09f856f',
    messagingSenderId: '205434543166',
    projectId: 'attendance-79839',
    storageBucket: 'attendance-79839.firebasestorage.app',
  );

  
  
  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'YOUR_GOOGLE_API_KEY',
    appId: '1:205434543166:web:354b4a7e202b3ad09f856f',
    messagingSenderId: '205434543166',
    projectId: 'attendance-79839',
    storageBucket: 'attendance-79839.firebasestorage.app',
    iosBundleId: 'com.spc.attendance',
  );
}
