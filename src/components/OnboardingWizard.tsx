import React, { useState } from 'react';
import { StaffProfile } from '../types';
import { CodeOfConduct } from './CodeOfConduct';
import { User, ShieldAlert, Heart, Calendar, CreditCard, ChevronRight, Check } from 'lucide-react';

interface OnboardingWizardProps {
  email: string;
  onComplete: (profile: StaffProfile) => void;
  onCancel: () => void;
}

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  email,
  onComplete,
  onCancel
}) => {
  // Step switching
  const [step, setStep] = useState<1 | 2>(1);

  // Form Fields
  const [fullName, setFullName] = useState('');
  const [prefName, setPrefName] = useState('');
  const [pronouns, setPronouns] = useState('she/her');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  // Financial
  const [bankName, setBankName] = useState('');
  const [nameOnAccount, setNameOnAccount] = useState('');
  const [sortCode, setSortCode] = useState('');
  const [accountNumber, setAccountNumber] = useState('');

  // Emergency
  const [emName, setEmName] = useState('');
  const [emPhone, setEmPhone] = useState('');
  const [emRel, setEmRel] = useState('');

  // Medical
  const [medConditions, setMedConditions] = useState('');
  const [serAllergies, setSerAllergies] = useState('');

  // Code of Conduct Signature
  const [cocSigned, setCocSigned] = useState(false);
  const [cocSignature, setCocSignature] = useState('');
  const [cocDate, setCocDate] = useState('');

  const [formError, setFormError] = useState('');

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim() || !address.trim() || !bankName.trim() || !nameOnAccount.trim() || !sortCode.trim() || !accountNumber.trim() || !emName.trim() || !emPhone.trim() || !emRel.trim()) {
      setFormError('Please fill in all required fields marked with an asterisk (*).');
      return;
    }
    setFormError('');
    setStep(2);
  };

  const handleSignCodeOfConduct = (signature: string) => {
    setCocSignature(signature);
    setCocSigned(true);
    setCocDate(new Date().toISOString());
  };

  const handleSubmitProfile = () => {
    if (!cocSigned || !cocSignature.trim()) {
      setFormError('You must sign the Code of Conduct to complete your onboarding registration.');
      return;
    }

    const newProfile: StaffProfile = {
      id: `staff-${Date.now()}`,
      fullName: fullName.trim(),
      preferredName: prefName.trim() || fullName.split(' ')[0],
      phoneNumber: phone.trim(),
      email: email.toLowerCase().trim(),
      pronouns: pronouns.trim(),
      address: address.trim(),
      financialDetails: {
        bankName: bankName.trim(),
        nameOnAccount: nameOnAccount.trim(),
        sortCode: sortCode.trim(),
        accountNumber: accountNumber.trim()
      },
      emergencyContact: {
        name: emName.trim(),
        number: emPhone.trim(),
        relationship: emRel.trim()
      },
      medicalConditions: medConditions.trim() || 'None',
      seriousAllergies: serAllergies.trim() || 'None',
      codeOfConductSigned: true,
      codeOfConductSignedAt: cocDate,
      codeOfConductSignature: cocSignature,
      role: 'staff',
      createdAt: new Date().toISOString()
    };

    onComplete(newProfile);
  };

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-3xl overflow-hidden shadow-2xl text-slate-200" id="onboarding-wizard-container">
      {/* Steps bar */}
      <div className="bg-slate-900 px-6 py-4 border-b border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
            step === 1 ? 'bg-indigo-600 text-white' : 'bg-emerald-600/30 text-emerald-400'
          }`}>
            {step === 1 ? '1' : <Check size={14} />}
          </span>
          <span className="text-xs font-bold tracking-wider uppercase text-slate-300">
            Profile & Payment Details
          </span>
        </div>
        <ChevronRight className="text-slate-600" size={16} />
        <div className="flex items-center gap-4">
          <span className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
            step === 2 ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-500 border border-slate-700'
          }`}>
            2
          </span>
          <span className="text-xs font-bold tracking-wider uppercase text-slate-300">
            Agreement Sign-off
          </span>
        </div>
      </div>

      {formError && (
        <div className="m-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-start gap-3">
          <ShieldAlert size={20} className="shrink-0 mt-0.5" />
          <div className="text-xs font-semibold">{formError}</div>
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={handleNextStep} className="p-6 md:p-8 space-y-6">
          
          {/* Section 1: Credentials */}
          <div className="space-y-4">
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-indigo-400 flex items-center gap-2">
              <User size={14} /> Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Invited Email Address</label>
                <input
                  type="email"
                  disabled
                  value={email}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900/50 border border-slate-700 rounded-xl text-slate-400 cursor-not-allowed"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Full Legal Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Johnathan Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Preferred First Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. John"
                  value={prefName}
                  onChange={(e) => setPrefName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Pronouns</label>
                  <select
                    value={pronouns}
                    onChange={(e) => setPronouns(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="she/her">she/her</option>
                    <option value="he/him">he/him</option>
                    <option value="they/them">they/them</option>
                    <option value="other">other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-300">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    placeholder="+44 7..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">Home Address *</label>
              <textarea
                required
                rows={2}
                placeholder="Line 1, City, Postcode"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
              />
            </div>
          </div>

          {/* Section 2: Financial Details */}
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-indigo-400 flex items-center gap-2">
              <CreditCard size={14} /> Payout Banking Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Bank Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Barclays, Monzo"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Account Holder Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Legal name on bank account"
                  value={nameOnAccount}
                  onChange={(e) => setNameOnAccount(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Sort Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 20-30-40"
                  value={sortCode}
                  onChange={(e) => setSortCode(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Account Number *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 12345678"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Emergency & Medical */}
          <div className="space-y-4 pt-4 border-t border-slate-700">
            <h3 className="text-xs uppercase tracking-widest font-extrabold text-indigo-400 flex items-center gap-2">
              <Heart size={14} /> Emergency Contact & Medical
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Contact Name *</label>
                <input
                  type="text"
                  required
                  placeholder="Full Name"
                  value={emName}
                  onChange={(e) => setEmName(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Relationship *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Parent, Partner"
                  value={emRel}
                  onChange={(e) => setEmRel(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Contact Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="Phone number"
                  value={emPhone}
                  onChange={(e) => setEmPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-sm bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Medical Conditions</label>
                <textarea
                  rows={2}
                  placeholder="Pre-existing conditions or 'None'"
                  value={medConditions}
                  onChange={(e) => setMedConditions(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-300">Serious Allergies</label>
                <textarea
                  rows={2}
                  placeholder="e.g., Peanuts, carry Epipen, or 'None'"
                  value={serAllergies}
                  onChange={(e) => setSerAllergies(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-700 flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-2 bg-transparent text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl font-semibold text-sm transition-all cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-sm transition-all cursor-pointer flex items-center gap-1 shadow-lg shadow-indigo-600/10"
            >
              Next: Code of Conduct Agreement <ChevronRight size={16} />
            </button>
          </div>
        </form>
      ) : (
        <div className="p-6 md:p-8 space-y-6 bg-slate-800 text-slate-200">
          <div className="bg-slate-900 p-5 rounded-2xl border border-slate-700 space-y-2">
            <h3 className="font-extrabold text-sm text-indigo-400">Step 2: Sign Official Code of Conduct</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Before you can be assigned shifts and work at Savour Festivals, you must read, agree to, and sign our official Code of Conduct agreement.
            </p>
          </div>

          <CodeOfConduct
            isSigned={cocSigned}
            onSign={handleSignCodeOfConduct}
          />

          {cocSigned && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Check size={16} className="shrink-0" />
              <span>Signed successfully as <strong className="text-white">"{cocSignature}"</strong> on {new Date(cocDate).toLocaleDateString()}</span>
            </div>
          )}

          <div className="pt-6 border-t border-slate-700 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="px-5 py-2 bg-transparent text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-xl font-semibold text-sm transition-all cursor-pointer"
            >
              Back to Form
            </button>
            <button
              type="button"
              disabled={!cocSigned}
              onClick={handleSubmitProfile}
              className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-extrabold text-sm transition-all cursor-pointer flex items-center gap-1 shadow-lg shadow-emerald-600/10"
            >
              Complete Registration & Sign-up
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
