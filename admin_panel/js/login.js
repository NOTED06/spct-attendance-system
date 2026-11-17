

function togglePassword() {
    const input = document.getElementById('password');
    const icon = document.querySelector('.toggle-password');
    if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility';
    } else {
        input.type = 'password';
        icon.textContent = 'visibility_off';
    }
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorDiv = document.getElementById('loginError');
    const btnText = document.querySelector('.btn-text');
    const btnLoader = document.querySelector('.btn-loader');

    
    btnText.style.display = 'none';
    btnLoader.style.display = 'inline-flex';
    errorDiv.style.display = 'none';

    try {
        
        const credential = await auth.signInWithEmailAndPassword(email, password);

        
        const userDoc = await db.collection('users').doc(credential.user.uid).get();

        if (userDoc.exists && userDoc.data().role === 'admin') {
            
            window.location.href = 'dashboard.html';
        } else {
            
            await auth.signOut();
            errorDiv.textContent = 'Access denied. Admin privileges required.';
            errorDiv.style.display = 'block';
        }
    } catch (error) {
        let message = 'Login failed. Please try again.';
        switch (error.code) {
            case 'auth/user-not-found':
                message = 'No account found with this email.';
                break;
            case 'auth/wrong-password':
                message = 'Incorrect password. Please try again.';
                break;
            case 'auth/invalid-email':
                message = 'Please enter a valid email address.';
                break;
            case 'auth/too-many-requests':
                message = 'Too many attempts. Please try again later.';
                break;
            case 'auth/user-disabled':
                message = 'This account has been disabled.';
                break;
        }
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
    } finally {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
    }
});

async function resetPassword() {
    const email = document.getElementById('email').value.trim();
    if (!email) {
        alert('Please enter your email address first.');
        return;
    }

    try {
        await auth.sendPasswordResetEmail(email);
        alert('Password reset email sent. Check your inbox.');
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

auth.onAuthStateChanged(async (user) => {
    if (user) {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists && userDoc.data().role === 'admin') {
            window.location.href = 'dashboard.html';
        }
    }
});
