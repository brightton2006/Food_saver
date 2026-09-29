import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE } from '../../lib/api.js';
import {
  Heart, Building2, MapPin, FileText, Truck, Clock, ShieldCheck, Check,
  ChevronRight, ChevronLeft, Save, AlertCircle, CheckCircle2, User, Sparkles,
  LogOut, Shield
} from 'lucide-react';

const STEPS = [
  { id: 1, title: 'Organization Details', icon: Heart },
  { id: 2, title: 'Location & Service Area', icon: MapPin },
  { id: 3, title: 'Legal & Tax Verification', icon: FileText },
  { id: 4, title: 'Food Capabilities', icon: Truck },
  { id: 5, title: 'Operating Hours', icon: Clock },
  { id: 6, title: 'Representative Info', icon: User },
  { id: 7, title: 'Review & Submit', icon: ShieldCheck },
];

export default function NgoOnboardingWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const [formData, setFormData] = useState({
    // Step 1
    ngoName: '',
    organizationType: 'Trust',
    registrationNumber: 'REG-12456-NGO',
    yearEstablished: '2018',
    contactPersonName: '',
    phone: '',
    email: '',
    password: '',
    confirmPassword: '',

    // Step 2
    buildingNumber: '',
    street: '',
    area: '',
    city: 'Kovilpatti',
    state: 'Tamil Nadu',
    pincode: '628501',
    landmark: '',
    latitude: 9.1724,
    longitude: 77.8694,
    serviceRadiusKm: 5.0,

    // Step 3 Documents
    documents: [
      { type: '12A Certificate', number: '12A-TN-88942', file: '12a_cert.pdf', status: 'PENDING' },
      { type: '80G Certificate', number: '80G-TN-99410', file: '80g_tax_exemption.pdf', status: 'PENDING' },
      { type: 'FCRA Registration', number: 'FCRA-0400012', file: 'fcra_approval.pdf', status: 'PENDING' },
      { type: 'PAN Card', number: 'AAATN1234F', file: 'ngo_pan_card.pdf', status: 'PENDING' },
    ],

    // Step 4 Food Capabilities
    dailyRequirementServings: 150,
    maxPickupCapacityKg: 75.0,
    vehicleTypes: ['Two Wheeler', 'Auto/Van'],
    coldStorageAvailable: false,
    rawFoodAccepted: true,
    cookedFoodAccepted: true,
    packagedFoodAccepted: true,
    targetBeneficiaries: 'Underprivileged Children, Destitute Elderly & Local Shelter Homes',

    // Step 5 Operating Hours
    operatingHours: [
      { dayOfWeek: 'Monday', openingTime: '08:00', closingTime: '20:00', isClosed: false },
      { dayOfWeek: 'Tuesday', openingTime: '08:00', closingTime: '20:00', isClosed: false },
      { dayOfWeek: 'Wednesday', openingTime: '08:00', closingTime: '20:00', isClosed: false },
      { dayOfWeek: 'Thursday', openingTime: '08:00', closingTime: '20:00', isClosed: false },
      { dayOfWeek: 'Friday', openingTime: '08:00', closingTime: '20:00', isClosed: false },
      { dayOfWeek: 'Saturday', openingTime: '08:00', closingTime: '20:00', isClosed: false },
      { dayOfWeek: 'Sunday', openingTime: '08:00', closingTime: '20:00', isClosed: false },
    ],

    // Step 6 Representative
    designation: 'Managing Trustee / Director',
    idProofType: 'Aadhaar Card',
    idProofNumber: '7845-1234-9012',
    authorizationLetter: 'board_resolution_auth.pdf',

    // Step 7
    declarationAccepted: false,
  });

  // Pre-fill fields if user passed details from signup page
  useEffect(() => {
    if (location.state) {
      const { email, name, password, mobile, address, regDetails } = location.state;
      setFormData(prev => ({
        ...prev,
        email: email || prev.email,
        ngoName: name || prev.ngoName,
        contactPersonName: name || prev.contactPersonName,
        phone: mobile || prev.phone,
        password: password || prev.password,
        confirmPassword: password || prev.confirmPassword,
        buildingNumber: address || prev.buildingNumber,
        registrationNumber: regDetails || prev.registrationNumber,
      }));
    }
  }, [location.state]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrorMsg('');
  };

  const handleSendOtp = () => {
    if (!formData.phone || formData.phone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    setOtpSent(true);
    setSuccessMsg('SMS OTP sent to ' + formData.phone + ' (Simulated OTP: 123456)');
  };

  const handleVerifyOtp = () => {
    if (otpCode === '123456' || otpCode.length === 6) {
      setOtpVerified(true);
      setSuccessMsg('Mobile number verified successfully!');
      setErrorMsg('');
    } else {
      setErrorMsg('Invalid OTP code. Use 123456 for test verification.');
    }
  };

  const validateStep = (step) => {
    setErrorMsg('');
    if (step === 1) {
      if (!formData.ngoName.trim()) return 'NGO / Organization Name is required.';
      if (!formData.contactPersonName.trim()) return 'Contact Person Name is required.';
      if (!formData.email.trim() || !formData.email.includes('@')) return 'Valid Email address is required.';
      if (!formData.phone.trim() || formData.phone.length < 10) return 'Valid 10-digit mobile number is required.';
      if (!formData.password || formData.password.length < 6) return 'Password must be at least 6 characters.';
      if (formData.password !== formData.confirmPassword) return 'Password and Confirm Password do not match.';
    }
    if (step === 2) {
      if (!formData.buildingNumber.trim() && !formData.street.trim() && !formData.area.trim()) {
        return 'Please enter registered NGO address details.';
      }
      if (!formData.pincode.trim() || formData.pincode.length < 6) return 'Valid 6-digit Pincode is required.';
    }
    return null;
  };

  const getToken = () => {
    let token = localStorage.getItem('token');
    if (!token) {
      try {
        const stored = localStorage.getItem('foodsaver_session');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed?.token || null;
        }
      } catch (e) {}
    }
    return token;
  };

  const handleNextStep = async () => {
    const error = validateStep(currentStep);
    if (error) {
      setErrorMsg(error);
      return;
    }

    if (currentStep === 1 && !localStorage.getItem('token')) {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/ngo/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: formData.contactPersonName,
            email: formData.email,
            phone: formData.phone,
            organizationName: formData.ngoName,
            organizationType: formData.organizationType,
            password: formData.password,
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.message || 'NGO registration failed.');
          setLoading(false);
          return;
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', 'ngo');
        localStorage.setItem('foodsaver_session', JSON.stringify({
          token: data.token,
          role: 'NGO',
          email: formData.email,
          name: formData.contactPersonName,
          ngoName: formData.ngoName,
        }));
        setSuccessMsg('NGO User account registered as DRAFT.');
      } catch (err) {
        setErrorMsg('Network error. Make sure backend is running.');
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    saveDraft();
    setCurrentStep(prev => Math.min(STEPS.length, prev + 1));
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setCurrentStep(prev => Math.max(1, prev - 1));
  };

  const saveDraft = async () => {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(`${API_BASE}/api/ngo/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          addressDetails: {
            buildingNumber: formData.buildingNumber,
            street: formData.street,
            area: formData.area,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            landmark: formData.landmark,
            latitude: formData.latitude,
            longitude: formData.longitude,
          },
          foodCapabilities: {
            dailyRequirementServings: formData.dailyRequirementServings,
            maxPickupCapacityKg: formData.maxPickupCapacityKg,
            vehicleTypes: formData.vehicleTypes,
            coldStorageAvailable: formData.coldStorageAvailable,
            rawFoodAccepted: formData.rawFoodAccepted,
            cookedFoodAccepted: formData.cookedFoodAccepted,
            packagedFoodAccepted: formData.packagedFoodAccepted,
            targetBeneficiaries: formData.targetBeneficiaries,
          },
          operatingHours: formData.operatingHours,
        })
      });
    } catch (err) {
      console.log('NGO draft save error', err);
    }
  };

  const handleSubmitOnboarding = async () => {
    if (!formData.declarationAccepted) {
      setErrorMsg('You must accept the legal declaration before submitting.');
      return;
    }
    setLoading(true);
    setErrorMsg('');

    try {
      const token = getToken();
      if (!token) {
        setErrorMsg('Authentication token missing. Please log in again.');
        setLoading(false);
        return;
      }
      const res = await fetch(`${API_BASE}/api/ngo/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          ...formData,
          addressDetails: {
            buildingNumber: formData.buildingNumber,
            street: formData.street,
            area: formData.area,
            city: formData.city,
            state: formData.state,
            pincode: formData.pincode,
            landmark: formData.landmark,
            latitude: formData.latitude,
            longitude: formData.longitude,
          },
          foodCapabilities: {
            dailyRequirementServings: formData.dailyRequirementServings,
            maxPickupCapacityKg: formData.maxPickupCapacityKg,
            vehicleTypes: formData.vehicleTypes,
            coldStorageAvailable: formData.coldStorageAvailable,
            rawFoodAccepted: formData.rawFoodAccepted,
            cookedFoodAccepted: formData.cookedFoodAccepted,
            packagedFoodAccepted: formData.packagedFoodAccepted,
            targetBeneficiaries: formData.targetBeneficiaries,
          },
          operatingHours: formData.operatingHours,
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.message || 'Failed to submit NGO application.');
        setLoading(false);
        return;
      }

      setSuccessMsg('Your NGO Verification Application has been SUBMITTED!');
      setTimeout(() => {
        alert('NGO Verification Application Submitted! Your account is now UNDER REVIEW by FoodSaver Administrators.');
        navigate('/login');
      }, 1500);
    } catch (err) {
      setErrorMsg('Error submitting NGO application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F7FAF9] text-[#172321] flex flex-col font-sans selection:bg-[#176B5B] selection:text-white overflow-x-hidden">
      {/* 1. TOP HEADER */}
      <header className="bg-white border-b border-[#D8E5E2] px-4 sm:px-8 py-3.5 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="FoodSaver" className="h-9 w-9 rounded-xl object-contain shadow-xs" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black text-[#172321] tracking-tight">FoodSaver</span>
                <span className="text-[11px] font-bold text-[#176B5B] bg-[#DDF4EE] border border-[#BDE8DE] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  NGO Rescue
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={saveDraft}
              className="px-4 py-2 bg-white hover:bg-[#F7FAF9] text-[#172321] border border-[#D8E5E2] rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 h-[38px] shadow-xs"
            >
              <Save className="h-3.5 w-3.5 text-[#176B5B]" />
              <span>Save Draft</span>
            </button>

            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-semibold text-[#65736F] hover:text-[#172321] hover:bg-[#EDF3F1] rounded-xl transition flex items-center space-x-1.5 h-[38px]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. WELCOME BANNER (Matching Login / Merchant Onboarding style) */}
      <section className="bg-white border-b border-[#D8E5E2] px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-[#DDF4EE] border border-[#BDE8DE] px-2.5 py-0.5 rounded-full text-[11px] font-bold text-[#176B5B] uppercase tracking-widest mb-1.5">
              <span>JOIN FOOD SAVER RESCUE PARTNERS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#172321] tracking-tight">
              Rescue surplus meals, empower local communities.
            </h1>
            <p className="text-xs sm:text-sm text-[#65736F] mt-1 max-w-2xl leading-relaxed">
              Complete your non-profit registration to receive unsold nutritious meals from verified restaurants and bakeries.
            </p>
          </div>

          <div className="hidden lg:flex items-center space-x-2 bg-[#F7FAF9] border border-[#D8E5E2] px-3.5 py-2 rounded-xl text-xs text-[#65736F] font-semibold shrink-0">
            <ShieldCheck className="h-4 w-4 text-[#176B5B]" />
            <span>Encrypted & Verified NGO Registration</span>
          </div>
        </div>
      </section>

      {/* 3. MAIN DASHBOARD CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col md:flex-row gap-8">
        {/* Left Stepper Sidebar */}
        <aside className="w-full md:w-72 shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-[#D8E5E2] p-4 shadow-sm sticky top-24 space-y-3">
            <div className="px-2 pt-1 pb-2 border-b border-[#D8E5E2]">
              <h3 className="text-[11px] font-black text-[#65736F] uppercase tracking-widest">
                NGO WIZARD STEPS
              </h3>
            </div>

            <div className="space-y-1.5">
              {STEPS.map((step) => {
                const isCurrent = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div
                    key={step.id}
                    onClick={() => (isCompleted || isCurrent) && setCurrentStep(step.id)}
                    className={`relative flex items-center space-x-3 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                      isCurrent
                        ? 'bg-[#DDF4EE] text-[#176B5B] font-bold border border-[#BDE8DE] shadow-xs'
                        : isCompleted
                        ? 'text-[#172321] hover:bg-[#F7FAF9] font-semibold'
                        : 'text-[#8A9490] hover:bg-[#F7FAF9]'
                    }`}
                  >
                    {isCurrent && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#176B5B] rounded-r-full" />
                    )}

                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold ${
                        isCurrent
                          ? 'bg-[#176B5B] text-white shadow-xs'
                          : isCompleted
                          ? 'bg-[#2E8B72] text-white'
                          : 'bg-[#EDF3F1] text-[#8A9490]'
                      }`}
                    >
                      {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : step.id}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{step.title}</p>
                      <p className="text-[10px] text-[#65736F]">
                        {isCompleted ? 'Completed' : isCurrent ? 'Active Step' : 'Pending'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Right Form Container */}
        <section className="flex-1 bg-white border border-[#D8E5E2] rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-[#D8E5E2] pb-4 mb-6">
              <div>
                <span className="text-xs font-bold text-[#176B5B] uppercase tracking-wider">
                  Step {currentStep} of {STEPS.length}
                </span>
                <h2 className="text-2xl font-black text-[#172321] mt-0.5">{STEPS[currentStep - 1].title}</h2>
              </div>
              <span className="px-3 py-1 bg-[#DDF4EE] text-[#176B5B] border border-[#BDE8DE] rounded-full text-xs font-bold">
                NGO Verification
              </span>
            </div>

            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start space-x-3 text-rose-800">
                <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{errorMsg}</p>
              </div>
            )}
            {successMsg && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start space-x-3 text-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-sm font-medium">{successMsg}</p>
              </div>
            )}

            {/* STEP 1: ORGANIZATION DETAILS */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">NGO / Organization Name *</label>
                    <input
                      type="text"
                      value={formData.ngoName}
                      onChange={(e) => handleInputChange('ngoName', e.target.value)}
                      placeholder="e.g. Second Harvest Community Kitchen"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Organization Structure *</label>
                    <select
                      value={formData.organizationType}
                      onChange={(e) => handleInputChange('organizationType', e.target.value)}
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    >
                      <option value="Trust">Registered Public Trust</option>
                      <option value="Society">Registered Society</option>
                      <option value="Section 8 Company">Section 8 Non-Profit Company</option>
                      <option value="Non-Profit">Non-Profit Organization</option>
                      <option value="Other">Other Community Group</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Registration Number</label>
                    <input
                      type="text"
                      value={formData.registrationNumber}
                      onChange={(e) => handleInputChange('registrationNumber', e.target.value)}
                      placeholder="REG-12456-NGO"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition font-mono shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Contact Person Full Name *</label>
                    <input
                      type="text"
                      value={formData.contactPersonName}
                      onChange={(e) => handleInputChange('contactPersonName', e.target.value)}
                      placeholder="e.g. Dr. Arisudan Muthu"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Email Address *</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="secondharvest@ngo.org"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Mobile Number *</label>
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="+91 91234 56789"
                        className="flex-1 bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                      />
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        className="px-4 py-3 bg-[#DDF4EE] hover:bg-[#cdeee5] text-[#176B5B] border border-[#BDE8DE] rounded-xl text-xs font-bold transition shadow-xs"
                      >
                        {otpSent ? 'Resend OTP' : 'Send OTP'}
                      </button>
                    </div>
                  </div>
                </div>

                {otpSent && (
                  <div className="p-4 bg-[#F7FAF9] border border-[#D8E5E2] rounded-xl flex items-center space-x-4">
                    <input
                      type="text"
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      placeholder="Enter 123456"
                      className="bg-white border border-[#D8E5E2] rounded-xl px-4 py-2 text-sm text-[#172321] font-mono text-center focus:border-[#176B5B] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      className="px-4 py-2 bg-[#176B5B] text-white font-bold rounded-xl text-xs shadow-xs"
                    >
                      Verify OTP
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Password *</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => handleInputChange('password', e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Confirm Password *</label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: LOCATION */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Building / Facility Name</label>
                    <input
                      type="text"
                      value={formData.buildingNumber}
                      onChange={(e) => handleInputChange('buildingNumber', e.target.value)}
                      placeholder="Community Kitchen Hall"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Street Name</label>
                    <input
                      type="text"
                      value={formData.street}
                      onChange={(e) => handleInputChange('street', e.target.value)}
                      placeholder="Station Road"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Area / Locality</label>
                    <input
                      type="text"
                      value={formData.area}
                      onChange={(e) => handleInputChange('area', e.target.value)}
                      placeholder="Kovilpatti Central"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">City *</label>
                    <input
                      type="text"
                      value={formData.city}
                      onChange={(e) => handleInputChange('city', e.target.value)}
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Pincode *</label>
                    <input
                      type="text"
                      value={formData.pincode}
                      onChange={(e) => handleInputChange('pincode', e.target.value)}
                      placeholder="628501"
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] placeholder-[#8A9490] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition font-mono shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Food Rescue Service Radius (km)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.serviceRadiusKm}
                    onChange={(e) => handleInputChange('serviceRadiusKm', parseFloat(e.target.value))}
                    className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition font-mono shadow-xs"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: LEGAL & TAX VERIFICATION */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="p-4 rounded-xl bg-[#DDF4EE]/60 border border-[#BDE8DE] flex items-center space-x-3 text-[#0D4037]">
                  <FileText className="h-6 w-6 text-[#176B5B] shrink-0" />
                  <p className="text-xs leading-relaxed">
                    Please provide tax exemption certificates (12A/80G) and organization legal identification documents.
                  </p>
                </div>

                <div className="space-y-3">
                  {formData.documents.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-[#F7FAF9] border border-[#D8E5E2] rounded-xl hover:border-[#176B5B] transition shadow-xs">
                      <div>
                        <h4 className="text-sm font-bold text-[#172321]">{doc.type}</h4>
                        <p className="text-xs text-[#65736F] font-mono mt-0.5">Doc #: {doc.number} | Ref: {doc.file}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#DDF4EE] border border-[#BDE8DE] text-[#176B5B]">
                        {doc.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: FOOD CAPABILITIES */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Daily Food Requirement (Servings)</label>
                    <input
                      type="number"
                      value={formData.dailyRequirementServings}
                      onChange={(e) => handleInputChange('dailyRequirementServings', Number(e.target.value))}
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition font-mono shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Max Pickup Capacity per Trip (kg)</label>
                    <input
                      type="number"
                      value={formData.maxPickupCapacityKg}
                      onChange={(e) => handleInputChange('maxPickupCapacityKg', Number(e.target.value))}
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition font-mono shadow-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Target Beneficiaries & Food Usage</label>
                  <textarea
                    rows={3}
                    value={formData.targetBeneficiaries}
                    onChange={(e) => handleInputChange('targetBeneficiaries', e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                  />
                </div>

                <div className="flex flex-wrap gap-6 pt-2">
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.cookedFoodAccepted}
                      onChange={(e) => handleInputChange('cookedFoodAccepted', e.target.checked)}
                      className="h-5 w-5 rounded border-[#D8E5E2] text-[#176B5B] accent-[#176B5B]"
                    />
                    <span className="text-sm font-semibold text-[#172321]">Cooked Meals Accepted</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.packagedFoodAccepted}
                      onChange={(e) => handleInputChange('packagedFoodAccepted', e.target.checked)}
                      className="h-5 w-5 rounded border-[#D8E5E2] text-[#176B5B] accent-[#176B5B]"
                    />
                    <span className="text-sm font-semibold text-[#172321]">Packaged Groceries Accepted</span>
                  </label>
                  <label className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.coldStorageAvailable}
                      onChange={(e) => handleInputChange('coldStorageAvailable', e.target.checked)}
                      className="h-5 w-5 rounded border-[#D8E5E2] text-[#176B5B] accent-[#176B5B]"
                    />
                    <span className="text-sm font-semibold text-[#172321]">Cold Storage Available</span>
                  </label>
                </div>
              </div>
            )}

            {/* STEP 5: OPERATING HOURS */}
            {currentStep === 5 && (
              <div className="space-y-4">
                <p className="text-xs text-[#65736F]">Configure your community center pickup operating hours.</p>
                <div className="space-y-2.5">
                  {formData.operatingHours.map((hr, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3.5 bg-[#F7FAF9] border border-[#D8E5E2] rounded-xl shadow-xs">
                      <span className="w-28 text-sm font-bold text-[#172321]">{hr.dayOfWeek}</span>
                      <div className="flex items-center space-x-2">
                        <input
                          type="time"
                          value={hr.openingTime}
                          onChange={(e) => {
                            const newHrs = [...formData.operatingHours];
                            newHrs[idx].openingTime = e.target.value;
                            setFormData(prev => ({ ...prev, operatingHours: newHrs }));
                          }}
                          className="bg-white border border-[#D8E5E2] rounded-lg px-2.5 py-1 text-xs text-[#172321] focus:border-[#176B5B] focus:outline-none font-mono"
                        />
                        <span className="text-xs text-[#65736F]">to</span>
                        <input
                          type="time"
                          value={hr.closingTime}
                          onChange={(e) => {
                            const newHrs = [...formData.operatingHours];
                            newHrs[idx].closingTime = e.target.value;
                            setFormData(prev => ({ ...prev, operatingHours: newHrs }));
                          }}
                          className="bg-white border border-[#D8E5E2] rounded-lg px-2.5 py-1 text-xs text-[#172321] focus:border-[#176B5B] focus:outline-none font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 6: REPRESENTATIVE INFO */}
            {currentStep === 6 && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Representative Designation</label>
                    <input
                      type="text"
                      value={formData.designation}
                      onChange={(e) => handleInputChange('designation', e.target.value)}
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition shadow-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#172321] uppercase tracking-wider mb-2">Govt ID Proof Number</label>
                    <input
                      type="text"
                      value={formData.idProofNumber}
                      onChange={(e) => handleInputChange('idProofNumber', e.target.value)}
                      className="w-full bg-[#FFFFFF] border border-[#D8E5E2] rounded-xl px-4 py-3 text-sm text-[#172321] focus:outline-none focus:border-[#176B5B] focus:ring-2 focus:ring-[#176B5B]/15 transition font-mono shadow-xs"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 7: REVIEW & SUBMIT */}
            {currentStep === 7 && (
              <div className="space-y-6">
                <div className="p-6 bg-[#F7FAF9] border border-[#D8E5E2] rounded-2xl space-y-4 shadow-xs">
                  <h3 className="text-base font-bold text-[#172321] border-b border-[#D8E5E2] pb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#176B5B]" />
                    <span>NGO Application Summary</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-xs text-[#65736F]">NGO Name</p>
                      <p className="font-bold text-[#172321]">{formData.ngoName || 'Second Harvest'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#65736F]">Organization Structure</p>
                      <p className="font-bold text-[#172321]">{formData.organizationType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#65736F]">Daily Capacity</p>
                      <p className="font-bold text-[#176B5B]">{formData.dailyRequirementServings} Servings / Day</p>
                    </div>
                    <div>
                      <p className="text-xs text-[#65736F]">Legal Documents</p>
                      <p className="font-bold text-[#172321]">{formData.documents.length} Verified Docs Attached</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#FFF4EB] border border-[#FDC8A4]">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.declarationAccepted}
                      onChange={(e) => handleInputChange('declarationAccepted', e.target.checked)}
                      className="h-5 w-5 rounded border-[#FDC8A4] text-[#176B5B] accent-[#176B5B] mt-0.5"
                    />
                    <span className="text-xs text-[#B45309] leading-relaxed font-medium">
                      "I confirm that this organization is legally registered, non-commercial, and authorized to collect surplus food for charitable distribution."
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Stepper Footer Controls */}
          <div className="flex items-center justify-between border-t border-[#D8E5E2] pt-6 mt-8">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={handlePrevStep}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-bold transition shadow-xs ${
                currentStep === 1
                  ? 'opacity-30 cursor-not-allowed bg-[#EDF3F1] text-[#8A9490]'
                  : 'bg-[#EDF3F1] hover:bg-[#D8E5E2] text-[#172321] border border-[#D8E5E2]'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            {currentStep < 7 ? (
              <button
                type="button"
                onClick={handleNextStep}
                disabled={loading}
                className="flex items-center space-x-2 px-6 py-2.5 bg-[#176B5B] hover:bg-[#0D4037] text-white font-bold rounded-xl text-xs shadow-xs transition active:scale-95"
              >
                <span>Save & Next</span>
                <ChevronRight className="h-4 w-4 stroke-[3]" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitOnboarding}
                disabled={loading}
                className="flex items-center space-x-2 px-8 py-3 bg-[#176B5B] hover:bg-[#0D4037] text-white font-black rounded-xl text-xs shadow-md transition active:scale-95 uppercase tracking-wider"
              >
                <Sparkles className="h-4 w-4" />
                <span>{loading ? 'Submitting...' : 'SUBMIT NGO VERIFICATION'}</span>
              </button>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
