/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Shield, LogIn, Sparkles, AlertCircle, HelpCircle, Mail, ArrowRight, Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { loginWithEmailPassword, registerWithEmailPassword, resetUserPassword } from '../utils/googleAuth';
import { ADMIN_EMAILS } from '../types';

interface LoginScreenProps {
  onLoginSuccess: (email: string, role: 'admin' | 'staff', googleToken?: string | null) => void;
  staffProfiles: any[];
  onStartOnboarding?: (email: string) => void;
  invitations?: any[];
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  onLoginSuccess,
  staffProfiles,
  onStartOnboarding,
  invitations = []
}) => {
  const [step, setStep] = useState<'email' | 'login' | 'register' | 'not_found'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpConfirmPassword, setSignUpConfirmPassword] = useState('');
  const [showPasscodeForm, setShowPasscodeForm] = useState(false);
  const [adminEmail, setAdminEmail] = useState('dayne@savourfestival.com');
  const [adminCode, setAdminCode] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Extract email or onboardEmail query parameter on mount for frictionless landing page support
  useEffect(() => {
    let active = true;
    const loadAndRoute = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const emailParam = params.get('email') || params.get('onboardEmail');
        if (emailParam) {
          const cleanEmail = emailParam.trim().toLowerCase();
          setEmail(cleanEmail);
          setIsLoading(true);

          let currentProfilesList = staffProfiles;
          let currentInvitationsList = invitations;

          try {
            const { getStaffProfilesFromFirestore, getInvitationsFromFirestore } = await import('../utils/firestoreData');
            const [liveProfiles, liveInvs] = await Promise.all([
              getStaffProfilesFromFirestore(),
              getInvitationsFromFirestore()
            ]);

            if (liveProfiles && liveProfiles.length > 0) {
              currentProfilesList = liveProfiles;
            }
            if (liveInvs && liveInvs.length > 0) {
              currentInvitationsList = liveInvs;
            }
          } catch (e) {
            console.warn("Frictionless routing: failed to load database registries:", e);
          }

          if (!active) return;

          const isRegistered = currentProfilesList.some(
            (p) => p.email.toLowerCase().trim() === cleanEmail
          ) || ADMIN_EMAILS.includes(cleanEmail);

          const isInvited = currentInvitationsList.some(
            (i) => i.email.toLowerCase().trim() === cleanEmail
          );

          if (isRegistered) {
            setStep('login');
          } else if (isInvited) {
            setStep('register');
          } else {
            setStep('not_found');
          }
        }
      } catch (e) {
        console.warn("Failed to parse URL query params or auto-route:", e);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    loadAndRoute();
    return () => {
      active = false;
    };
  }, [staffProfiles, invitations]);

  const handleCheckEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setMessage(null);
    const emailClean = email.trim().toLowerCase();

    if (!emailClean) {
      setLoginError('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      // Fetch newest staff profiles and invitations from Firestore to prevent stale local checks
      let currentProfilesList = staffProfiles;
      let currentInvitationsList = invitations;

      try {
        const { getStaffProfilesFromFirestore, getInvitationsFromFirestore } = await import('../utils/firestoreData');
        const [liveProfiles, liveInvs] = await Promise.all([
          getStaffProfilesFromFirestore(),
          getInvitationsFromFirestore()
        ]);

        if (liveProfiles && liveProfiles.length > 0) {
          currentProfilesList = liveProfiles;
        }
        if (liveInvs && liveInvs.length > 0) {
          currentInvitationsList = liveInvs;
        }
      } catch (e) {
        console.warn("Check Email: failed to pull live whitelists, using local state:", e);
      }

      const isRegistered = currentProfilesList.some(
        (p) => p.email.toLowerCase().trim() === emailClean
      ) || ADMIN_EMAILS.includes(emailClean);

      // Check invitations list
      const isInvited = currentInvitationsList.some(
        (i) => i.email.toLowerCase().trim() === emailClean
      );

      if (isRegistered) {
        setStep('login');
      } else if (isInvited) {
        setStep('register');
      } else {
        setStep('not_found');
      }
    } catch (err: any) {
      setLoginError(err.message || 'Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailPasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setMessage(null);
    const emailClean = email.trim().toLowerCase();
    const pwd = password;

    if (!emailClean || !pwd) {
      setLoginError('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      const user = await loginWithEmailPassword(emailClean, pwd);
      
      // Fetch newest staff profiles from Firestore to prevent stale local whitelists
      let currentProfilesList = staffProfiles;
      try {
        const { getStaffProfilesFromFirestore } = await import('../utils/firestoreData');
        const live = await getStaffProfilesFromFirestore();
        if (live && live.length > 0) {
          currentProfilesList = live;
        }
      } catch (dbErr) {
        console.error("Login Screen: failed to pull live whitelists from Firestore:", dbErr);
      }

      // Check if this email is an admin
      if (ADMIN_EMAILS.includes(emailClean)) {
        onLoginSuccess(emailClean, 'admin', null);
        return;
      }

      // Check if registered in staff profiles
      let matchedProfile = currentProfilesList.find(
        (p) => p.email.toLowerCase().trim() === emailClean
      );

      if (!matchedProfile) {
        // Fallback: Check local staffProfiles prop (from localStorage)
        const localProfile = staffProfiles.find(
          (p) => p.email.toLowerCase().trim() === emailClean
        );
        if (localProfile) {
          try {
            const { saveStaffProfileToFirestore, markInvitationRegisteredInFirestore } = await import('../utils/firestoreData');
            await saveStaffProfileToFirestore(localProfile);
            await markInvitationRegisteredInFirestore(localProfile.email);
            matchedProfile = localProfile;
          } catch (syncErr) {
            console.error("Login Screen: failed to sync local profile to Firestore:", syncErr);
          }
        }
      }

      if (matchedProfile) {
        const role = matchedProfile.role || 'staff';
        onLoginSuccess(emailClean, role, null);
      } else {
        setStep('not_found');
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Login failed. Please check your credentials.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        errMsg = 'Incorrect email or password. Please try again.';
      } else if (err.code === 'auth/invalid-email') {
        errMsg = 'Please enter a valid email address.';
      } else if (err.message) {
        errMsg = err.message;
      }
      setLoginError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setMessage(null);
    const emailClean = email.trim().toLowerCase();
    if (!emailClean) return;

    if (!signUpPassword) {
      setLoginError('Please choose a password.');
      return;
    }
    if (signUpPassword.length < 6) {
      setLoginError('Password must be at least 6 characters long.');
      return;
    }
    if (signUpPassword !== signUpConfirmPassword) {
      setLoginError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      // Save invited email to sessionStorage for reference in onboarding wizard
      sessionStorage.setItem('savour_pending_invited_email', emailClean);
      
      // Register using email/password
      await registerWithEmailPassword(emailClean, signUpPassword);
      
      // Proceed to onboarding using their registered email
      if (onStartOnboarding) {
        onStartOnboarding(emailClean);
      }
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || 'Registration failed. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = 'This email address is already in use by another account. Try logging in instead.';
        setStep('login');
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'The password is too weak. Please use at least 6 characters.';
      }
      setLoginError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoginError(null);
    setMessage(null);
    const emailClean = email.trim().toLowerCase();
    if (!emailClean) {
      setLoginError('Please enter your email address.');
      return;
    }
    setIsLoading(true);
    try {
      await resetUserPassword(emailClean);
      setMessage(`A password reset link has been successfully sent to "${emailClean}". Please check your inbox and spam folders.`);
    } catch (err: any) {
      console.error(err);
      let errMsg = 'Failed to send password reset email. Please try again.';
      if (err.code === 'auth/user-not-found') {
        errMsg = 'No user account found with this email address.';
      } else if (err.message) {
        errMsg = err.message;
      }
      setLoginError(errMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdminPasscodeLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setMessage(null);
    const emailClean = adminEmail.trim().toLowerCase();
    
    if (ADMIN_EMAILS.includes(emailClean) && adminCode === 'admin2026') {
      onLoginSuccess(emailClean, 'admin', null);
      return;
    }

    const matchedProfile = staffProfiles.find(
      (p) => p.email.toLowerCase().trim() === emailClean && p.role === 'admin'
    );

    if (matchedProfile && adminCode === 'admin2026') {
      onLoginSuccess(emailClean, 'admin', null);
      return;
    }

    setLoginError('Invalid Administrator credentials or access code. Please check your entry.');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 md:p-8 select-none font-sans" id="login-container">
      <div className="max-w-md w-full bg-white border border-slate-200/80 rounded-3xl p-6 md:p-8 shadow-xl shadow-slate-200/30 space-y-6 md:space-y-8 animate-fade-in">
        
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex h-14 w-14 bg-slate-900 text-white rounded-2xl items-center justify-center font-black text-2xl shadow-md shadow-slate-900/25">
            🎪
          </div>
          <div className="space-y-1">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-950 tracking-tight">
              Savour Staff Portal
            </h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">
              Onboarding & Shift Coordination
            </p>
          </div>
        </div>

        {/* Error Notice */}
        {loginError && (
          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-800 text-xs md:text-sm leading-relaxed flex items-start gap-2.5">
            <AlertCircle size={16} className="text-rose-600 shrink-0 mt-0.5" />
            <div className="font-semibold">{loginError}</div>
          </div>
        )}

        {/* Success / Info Message */}
        {message && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800 text-xs md:text-sm leading-relaxed flex items-start gap-2.5">
            <CheckCircle size={16} className="text-emerald-600 shrink-0 mt-0.5" />
            <div className="font-semibold">{message}</div>
          </div>
        )}

        {/* Unified Easy Step-by-Step Flow */}
        <div className="space-y-6">
          {step === 'email' && (
            <form onSubmit={handleCheckEmailSubmit} className="space-y-5 animate-fade-in" id="check-email-form">
              <div className="text-center space-y-1.5">
                <h2 className="text-sm font-extrabold text-slate-800">
                  Welcome to Savour Staff
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Enter your email address to log in or complete your invited onboarding registration.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Email Address
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-md shadow-indigo-600/15 hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Continue</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'login' && (
            <form onSubmit={handleEmailPasswordLogin} className="space-y-5 animate-fade-in" id="password-login-form">
              <div className="text-center space-y-1.5">
                <h2 className="text-sm font-extrabold text-slate-800">
                  Welcome Back!
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Enter your password to sign into your registered staff account.
                </p>
              </div>

              {/* Email badge indicator with back/change option */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2 truncate">
                  <Mail size={14} className="text-indigo-600 shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setLoginError(null);
                    setMessage(null);
                  }}
                  className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold uppercase tracking-wider underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold uppercase tracking-wider cursor-pointer"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-md shadow-indigo-600/15 hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <LogIn size={15} />
                    <span>Log In to Portal</span>
                  </>
                )}
              </button>
            </form>
          )}

          {step === 'register' && (
            <form onSubmit={handleSignUpSubmit} className="space-y-5 animate-fade-in" id="password-register-form">
              <div className="text-center space-y-1.5">
                <h2 className="text-sm font-extrabold text-slate-800 flex items-center justify-center gap-1.5">
                  <Sparkles size={16} className="text-indigo-600 animate-pulse" /> Complete Onboarding
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Your invitation has been verified! Choose a secure password to activate your portal account.
                </p>
              </div>

              {/* Email badge indicator with back/change option */}
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between text-xs font-semibold text-slate-700">
                <div className="flex items-center gap-2 truncate">
                  <Mail size={14} className="text-emerald-600 shrink-0" />
                  <span className="truncate">{email}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStep('email');
                    setLoginError(null);
                    setMessage(null);
                  }}
                  className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold uppercase tracking-wider underline cursor-pointer"
                >
                  Change
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Choose Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="Min. 6 characters"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="Verify your password"
                    value={signUpConfirmPassword}
                    onChange={(e) => setSignUpConfirmPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 text-sm border border-slate-200 rounded-xl focus:border-indigo-500 focus:outline-none bg-slate-50/50"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-98 text-white font-extrabold text-sm rounded-xl shadow-md shadow-indigo-600/15 hover:shadow-lg transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Verify & Register Account</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>

              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100/50 rounded-2xl text-[11px] leading-relaxed text-indigo-950 flex gap-2">
                <HelpCircle size={14} className="text-indigo-600 shrink-0 mt-0.5" />
                <div>
                  Setting up an email and password secures your login natively without needing external Google account links.
                </div>
              </div>
            </form>
          )}

          {step === 'not_found' && (
            <div className="space-y-5 animate-fade-in" id="no-invitation-form">
              <div className="text-center space-y-1.5">
                <h2 className="text-sm font-extrabold text-slate-800">
                  No Invitation Found
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  We couldn't find an active staff invitation or registered account for this email address.
                </p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-900 text-xs leading-relaxed flex flex-col gap-2 font-medium">
                <p>
                  Your entered email address is: <strong className="font-semibold block mt-0.5 text-amber-950 font-mono text-center">{email}</strong>
                </p>
                <p>
                  Please make sure you are entering the exact email address where you received your invitation. If you are a new staff member, your administrator must invite you via the management console before you can register.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setStep('email');
                  setLoginError(null);
                  setMessage(null);
                }}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-98"
              >
                <ArrowLeft size={13} />
                <span>Try another email address</span>
              </button>
            </div>
          )}
        </div>

        {/* Coordinator Passcode Access Section */}
        <div className="pt-2 text-center border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setShowPasscodeForm(!showPasscodeForm);
              setLoginError(null);
              setMessage(null);
            }}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center justify-center gap-1.5 mx-auto cursor-pointer transition-colors"
          >
            <Shield size={13} className="text-slate-400" />
            {showPasscodeForm ? 'Hide Coordinator Passcode Login' : 'Sign in with Coordinator Passcode fallback'}
          </button>
        </div>

        {/* Admin Passcode Fallback Form */}
        {showPasscodeForm && (
          <form onSubmit={handleAdminPasscodeLogin} className="space-y-4 pt-2 border-t border-dashed border-slate-200/60 animate-slide-down" id="admin-login-fallback">
            <div className="text-center space-y-1 mb-2">
              <h3 className="text-xs font-bold text-slate-700">Coordinator Passcode Fallback</h3>
              <p className="text-[10px] text-slate-400">Access Festival HQ operations via email & passcode when needed</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Administrator Email</label>
              <input
                type="email"
                required
                placeholder="dayne@savourfestival.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-slate-800 focus:outline-none bg-slate-50/50"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">HQ Operations Access Code</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={adminCode}
                onChange={(e) => setAdminCode(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:border-slate-800 focus:outline-none bg-slate-50/50 tracking-widest font-bold"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs rounded-lg transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2 mt-3"
            >
              <LogIn size={13} />
              Verify & Launch HQ
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="text-center text-[10px] text-slate-400 font-medium pt-2">
          © 2026 Savour Food Festival. Securely hosted operations engine.
        </div>
      </div>
    </div>
  );
};
