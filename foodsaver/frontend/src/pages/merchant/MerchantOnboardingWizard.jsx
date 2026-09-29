import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { API_BASE } from '../../lib/api.js';
import {
  Building2, User, MapPin, FileCheck2, UtensilsCrossed, Menu as MenuIcon,
  CreditCard, ShieldCheck, CheckCircle2, ChevronRight, ChevronLeft, Save,
  Plus, Trash2, Edit, AlertCircle, Eye, EyeOff, Check, Clock, Compass, FileText,
  Coffee, Hotel, Store, Wine, RefreshCw, Leaf, Mail, Phone, Lock, HelpCircle,
  UploadCloud, File, AlertTriangle, ExternalLink, Sparkles, LogOut, Info, Shield
} from 'lucide-react';
import RealMap from '../../components/RealMap.jsx';
import { searchLocation, reverseGeocode, getCurrentLocation, geocodeAddressHierarchy } from '../../services/locationService.js';

const STEPS = [
  { id: 1, num: '01', title: 'Owner Details', subtitle: 'Personal information', icon: User, formSubtitle: "Tell us who manages this business." },
  { id: 2, num: '02', title: 'Business Profile', subtitle: 'Business information', icon: Building2, formSubtitle: "Tell us about your restaurant, bakery, or kitchen establishment." },
  { id: 3, num: '03', title: 'Location', subtitle: 'Address & GPS', icon: MapPin, formSubtitle: "Specify your exact store location and customer notification radius." },
  { id: 4, num: '04', title: 'Documents', subtitle: 'Business verification', icon: FileCheck2, formSubtitle: "Upload your FSSAI license, GST, and proof of address documents." },
  { id: 5, num: '05', title: 'Operations', subtitle: 'Hours & service area', icon: Clock, formSubtitle: "Set up weekly opening hours and surplus pickup windows." },
  { id: 6, num: '06', title: 'Menu', subtitle: 'Food & pricing', icon: MenuIcon, formSubtitle: "Add surplus food items your business will offer to rescue customers." },
  { id: 7, num: '07', title: 'Bank Details', subtitle: 'Payout information', icon: CreditCard, formSubtitle: "Provide secure bank account details for weekly earnings payouts." },
  { id: 8, num: '08', title: 'Review', subtitle: 'Submit application', icon: ShieldCheck, formSubtitle: "Review all information carefully before submitting your application." },
];

const BUSINESS_TYPES = [
  { id: 'Restaurant', name: 'Restaurant', icon: UtensilsCrossed, desc: 'Dine-in or takeaway eatery' },
  { id: 'Hotel', name: 'Hotel / Resort', icon: Hotel, desc: 'Multi-cuisine hotel kitchen' },
  { id: 'Café', name: 'Café & Bakery', icon: Coffee, desc: 'Coffee, beverages & snacks' },
  { id: 'Bakery', name: 'Bakery & Sweets', icon: Store, desc: 'Cakes, pastries & savories' },
  { id: 'Cloud Kitchen', name: 'Cloud Kitchen', icon: Building2, desc: 'Delivery-only virtual kitchen' },
  { id: 'Bar', name: 'Bar & Lounge', icon: Wine, desc: 'Pub, drinks & finger food' },
];

const CUISINE_OPTIONS = [
  'South Indian', 'North Indian', 'Chinese', 'Biryani', 'Fast Food',
  'Bakery & Desserts', 'Street Food', 'Italian', 'Asian', 'Juices & Beverages'
];

const IMAGE_PRESETS = [
  { label: 'Biryani Special', url: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=500&q=80' },
  { label: 'Paneer Butter Gravy', url: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=500&q=80' },
  { label: 'Dosa & Tiffin Combo', url: 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?auto=format&fit=crop&w=500&q=80' },
  { label: 'Burger & Fries', url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=500&q=80' },
  { label: 'Pastry & Desserts', url: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=500&q=80' },
  { label: 'Fresh Fruit Juices', url: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?auto=format&fit=crop&w=500&q=80' },
];

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export default function MerchantOnboardingWizard() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  const [draftStatusText, setDraftStatusText] = useState('Saved just now');
  const [otpSent, setOtpSent] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [detectingGps, setDetectingGps] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1
    fullName: '',
    phone: '',
    email: '',
    contactNumber: '',
    password: '',
    confirmPassword: '',

    // Step 2
    businessName: '',
    businessType: 'Restaurant',
    cuisine: ['South Indian', 'Biryani'],
    description: '',
    yearEstablished: '2020',
    seatingCapacity: '40',
    foodType: 'Both',
    deliveryAvailable: true,
    takeawayAvailable: true,
    dineInAvailable: true,

    // Step 3
    buildingNumber: '',
    street: '',
    area: '',
    city: 'Kovilpatti',
    state: 'Tamil Nadu',
    pincode: '628501',
    landmark: '',
    googleMapsUrl: '',
    latitude: 9.1724,
    longitude: 77.8694,
    notificationRadius: 2.0,

    // Step 4 Verification Docs
    fssaiNumber: '',
    gstin: '',
    licenseNumber: '',
    documents: [
      { type: 'FSSAI License', number: '12421012000342', file: 'fssai_certificate.pdf', size: '2.4 MB', status: 'Verified' },
      { type: 'GST Certificate', number: '33AAAAA0000A1Z5', file: 'gst_registration.pdf', size: '1.8 MB', status: 'Verified' },
      { type: 'Address Proof', number: 'EB-7894211', file: 'electricity_bill.pdf', size: '940 KB', status: 'Uploaded' },
    ],

    // Step 5 Restaurant Info & Timings
    logo: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=300&q=80',
    coverImage: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1200&q=80',
    openingTime: '10:00',
    closingTime: '22:30',
    weeklyClosedDay: 'None',
    averagePrepTime: '20',
    minimumOrderAmount: '100',
    deliveryRadius: '5',
    deliveryFee: '25',
    amenities: ['Air Conditioned', 'Free WiFi', 'Dedicated Parking', 'Pure Veg Options'],

    // Step 6 Menu
    menuCategories: [
      { id: 1, name: 'Main Course', description: 'Fresh hot specialties', active: true },
      { id: 2, name: 'Starters & Snacks', description: 'Crispy delights', active: true },
    ],
    menuItems: [
      { id: 'item_1', name: 'Special Dum Biryani', description: 'Aromatic basmati rice cooked with secret spices', price: 240, discount: 60, finalPrice: 180, quantity: 10, pickupStart: '20:30', pickupEnd: '22:00', isVeg: false, category: 'Main Course', image: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=400&q=80', active: true },
      { id: 'item_2', name: 'Paneer Butter Masala', description: 'Rich cottage cheese in creamy tomato butter gravy', price: 220, discount: 40, finalPrice: 180, quantity: 8, pickupStart: '20:00', pickupEnd: '22:30', isVeg: true, category: 'Main Course', image: 'https://images.unsplash.com/photo-1631452180519-c014fe946bc7?auto=format&fit=crop&w=400&q=80', active: true }
    ],

    // Step 7 Settlement
    accountHolderName: '',
    bankAccount: '',
    confirmBankAccount: '',
    ifsc: '',
    bankName: 'HDFC Bank',

    // Step 8 Declaration
    declarationAccepted: false,
  });

  // Weekly Schedule State for Step 5
  const [weeklySchedule, setWeeklySchedule] = useState({
    Monday: { open: true, openingTime: '10:00', closingTime: '22:30' },
    Tuesday: { open: true, openingTime: '10:00', closingTime: '22:30' },
    Wednesday: { open: true, openingTime: '10:00', closingTime: '22:30' },
    Thursday: { open: true, openingTime: '10:00', closingTime: '22:30' },
    Friday: { open: true, openingTime: '10:00', closingTime: '22:30' },
    Saturday: { open: true, openingTime: '10:00', closingTime: '22:30' },
    Sunday: { open: true, openingTime: '10:00', closingTime: '22:30' },
  });

  // Modal for creating/editing menu item
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuForm, setMenuForm] = useState({
    name: '', description: '', price: '', discount: '', quantity: '5', pickupStart: '20:00', pickupEnd: '22:00', isVeg: true, category: 'Main Course', image: IMAGE_PRESETS[0].url
  });

  // File upload state for Step 4
  const [uploadingDocType, setUploadingDocType] = useState(null);
  const location = useLocation();

  // Pre-fill fields if user passed details from signup page
  useEffect(() => {
    if (location.state) {
      const { email, name, password, mobile, address, regDetails } = location.state;
      setFormData(prev => ({
        ...prev,
        email: email || prev.email,
        fullName: name || prev.fullName,
        businessName: name || prev.businessName,
        phone: mobile || prev.phone,
        contactNumber: mobile || prev.contactNumber,
        password: password || prev.password,
        confirmPassword: password || prev.confirmPassword,
        buildingNumber: address || prev.buildingNumber,
        fssaiNumber: regDetails || prev.fssaiNumber,
      }));
    }
  }, [location.state]);

  // Load existing profile details if merchant is logged in
  useEffect(() => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    if (token && role && role.toLowerCase() === 'merchant') {
      fetchExistingProfile();
    }
  }, []);

  const fetchExistingProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE}/api/merchant/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        const prof = data.profile || data;
        setFormData(prev => ({
          ...prev,
          fullName: prof.owner?.name || prof.owner_name || prev.fullName,
          phone: prof.owner?.phone || prof.contact_number || prev.phone,
          email: prof.owner?.email || prof.email || prev.email,
          businessName: prof.hotelName || prof.hotel_name || prev.businessName,
          businessType: prof.businessType || prof.business_type || prev.businessType,
          cuisine: prof.cuisine ? prof.cuisine.split('•').map(s => s.trim()) : prev.cuisine,
          buildingNumber: prof.address || prev.buildingNumber,
          openingTime: prof.openingHours ? prof.openingHours.split('-')[0]?.trim() || '10:00' : '10:00',
          closingTime: prof.openingHours ? prof.openingHours.split('-')[1]?.trim() || '22:30' : '22:30',
        }));
      }
    } catch (err) {
      console.log('No existing merchant profile loaded');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrorMsg('');
  };

  const toggleCuisine = (item) => {
    setFormData(prev => {
      const exists = prev.cuisine.includes(item);
      const updated = exists
        ? prev.cuisine.filter(c => c !== item)
        : [...prev.cuisine, item];
      return { ...prev, cuisine: updated };
    });
  };

  const toggleAmenity = (item) => {
    setFormData(prev => {
      const exists = prev.amenities.includes(item);
      const updated = exists
        ? prev.amenities.filter(a => a !== item)
        : [...prev.amenities, item];
      return { ...prev, amenities: updated };
    });
  };

  const handleSendOtp = () => {
    if (!formData.phone || formData.phone.length < 10) {
      setErrorMsg('Please enter a valid 10-digit mobile number.');
      return;
    }
    setOtpSent(true);
    setSuccessMsg(`SMS OTP sent to +91 ${formData.phone} (Test code: 123456)`);
  };

  const handleVerifyOtp = () => {
    if (otpCode === '123456' || otpCode.length === 6) {
      setOtpVerified(true);
      setSuccessMsg('Mobile number verified successfully!');
      setErrorMsg('');
    } else {
      setErrorMsg('Invalid OTP code. Enter 123456 for test verification.');
    }
  };

  const handleDetectLocation = async () => {
    setDetectingGps(true);
    setErrorMsg('');
    try {
      const pos = await getCurrentLocation({ enableHighAccuracy: true, timeout: 12000 });
      const address = await reverseGeocode(pos.latitude, pos.longitude);
      setFormData(prev => ({
        ...prev,
        latitude: Number(pos.latitude.toFixed(6)),
        longitude: Number(pos.longitude.toFixed(6)),
      }));
      setSuccessMsg(`📍 GPS Location acquired: ${pos.latitude.toFixed(4)}, ${pos.longitude.toFixed(4)} (${address})`);
    } catch (err) {
      setErrorMsg('Could not detect device GPS. Please enter coordinates or use Geocode Address.');
    } finally {
      setDetectingGps(false);
    }
  };

  const handleGeocodeAddress = async () => {
    const hasAddress = formData.street || formData.area || formData.city || formData.pincode || formData.buildingNumber;
    if (!hasAddress) {
      setErrorMsg('Please enter a street, area, or city first to geocode.');
      return;
    }
    setDetectingGps(true);
    setErrorMsg('');
    try {
      const result = await geocodeAddressHierarchy({
        buildingNumber: formData.buildingNumber,
        street: formData.street,
        area: formData.area,
        city: formData.city,
        pincode: formData.pincode,
        state: formData.state,
      });

      if (result && result.latitude && result.longitude) {
        setFormData(prev => ({
          ...prev,
          latitude: Number(result.latitude.toFixed(6)),
          longitude: Number(result.longitude.toFixed(6)),
        }));

        const levelLabel = result.matchLevel === 'street'
          ? 'Street level'
          : result.matchLevel === 'area'
          ? 'Area level'
          : result.matchLevel === 'pincode' || result.matchLevel === 'city_pincode'
          ? 'Postal code area'
          : 'City center';

        setSuccessMsg(`📍 ${levelLabel} coordinates located: ${result.displayName.slice(0, 55)} (${result.latitude.toFixed(4)}, ${result.longitude.toFixed(4)})`);
      } else {
        setErrorMsg('Could not detect coordinates. Please enter latitude/longitude manually or use GPS.');
      }
    } catch (err) {
      console.warn('Geocoding note:', err);
      setErrorMsg('Geocoding service unavailable. You can enter coordinates manually or use GPS.');
    } finally {
      setDetectingGps(false);
    }
  };

  const handleFileUpload = (docType, e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDocType(docType);
    setTimeout(() => {
      const newDoc = {
        type: docType,
        number: docType === 'FSSAI License' ? (formData.fssaiNumber || '14221012000492') : (formData.gstin || '33AAAAA0000A1Z5'),
        file: file.name,
        size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
        status: 'Uploaded successfully'
      };
      setFormData(prev => {
        const existingFiltered = prev.documents.filter(d => d.type !== docType);
        return { ...prev, documents: [...existingFiltered, newDoc] };
      });
      setUploadingDocType(null);
      setSuccessMsg(`${docType} document uploaded successfully.`);
    }, 600);
  };

  const handleRemoveDoc = (docType) => {
    setFormData(prev => ({
      ...prev,
      documents: prev.documents.filter(d => d.type !== docType)
    }));
  };

  const handleCopyMondaySchedule = () => {
    const mon = weeklySchedule.Monday;
    const updated = {};
    DAYS_OF_WEEK.forEach(day => {
      updated[day] = { ...mon };
    });
    setWeeklySchedule(updated);
    setSuccessMsg('Monday schedule applied to all days!');
  };

  const validateStep = (step) => {
    setErrorMsg('');
    if (step === 1) {
      if (!formData.fullName.trim()) return 'Full Legal Owner Name is required.';
      if (!formData.email.trim() || !formData.email.includes('@')) return 'Valid Official Email address is required.';
      if (!formData.phone.trim() || formData.phone.length < 10) return 'Valid 10-digit mobile number is required.';
      if (!formData.password || formData.password.length < 6) return 'Password must be at least 6 characters.';
      if (formData.password !== formData.confirmPassword) return 'Password and Confirm Password do not match.';
    }
    if (step === 2) {
      if (!formData.businessName.trim()) return 'Restaurant / Business Name is required.';
    }
    if (step === 3) {
      if (!formData.buildingNumber.trim() && !formData.street.trim() && !formData.area.trim()) {
        return 'Please enter building number, street or area details.';
      }
      if (!formData.pincode.trim() || formData.pincode.length < 6) return 'Valid 6-digit Pincode is required.';
    }
    if (step === 7) {
      if (!formData.accountHolderName.trim()) return 'Account Holder Name is required.';
      if (!formData.bankAccount.trim()) return 'Bank Account Number is required.';
      if (formData.bankAccount !== formData.confirmBankAccount) return 'Bank Account Numbers do not match.';
      if (!formData.ifsc.trim()) return 'Valid IFSC Code is required.';
    }
    return null;
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
        const res = await fetch(`${API_BASE}/api/merchant/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone,
            contactNumber: formData.contactNumber || formData.phone,
            password: formData.password,
            businessName: formData.businessName || 'Draft Merchant',
          })
        });
        const data = await res.json();
        if (!res.ok) {
          setErrorMsg(data.message || 'Registration failed.');
          setLoading(false);
          return;
        }
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', 'merchant');
        localStorage.setItem('foodsaver_session', JSON.stringify({
          token: data.token,
          role: 'MERCHANT',
          email: formData.email,
          name: formData.fullName,
          hotelName: formData.businessName || 'Draft Merchant',
        }));
        setSuccessMsg('Account registered as draft. Progress saved!');
      } catch (err) {
        setErrorMsg('Network connection error. Make sure backend server is running.');
        setLoading(false);
        return;
      }
      setLoading(false);
    }

    saveDraft();
    setCurrentStep(prev => Math.min(STEPS.length, prev + 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrevStep = () => {
    setErrorMsg('');
    setSuccessMsg('');
    setCurrentStep(prev => Math.max(1, prev - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  const saveDraft = async () => {
    const token = getToken();
    if (!token) return;
    setDraftSaving(true);
    try {
      await fetch(`${API_BASE}/api/merchant/save-draft`, {
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
            googleMapsUrl: formData.googleMapsUrl,
            latitude: formData.latitude,
            longitude: formData.longitude,
          },
          settlement: {
            accountHolderName: formData.accountHolderName,
            bankAccount: formData.bankAccount,
            ifsc: formData.ifsc,
            bankName: formData.bankName,
          },
          weeklySchedule
        })
      });
      setDraftStatusText('Saved just now');
      setTimeout(() => setDraftSaving(false), 500);
    } catch (err) {
      setDraftSaving(false);
    }
  };

  const handleSubmitOnboarding = async () => {
    if (!formData.declarationAccepted) {
      setErrorMsg('Please accept the declaration terms before submitting your application.');
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
      const res = await fetch(`${API_BASE}/api/merchant/submit`, {
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
            googleMapsUrl: formData.googleMapsUrl,
            latitude: formData.latitude,
            longitude: formData.longitude,
          },
          settlement: {
            accountHolderName: formData.accountHolderName,
            bankAccount: formData.bankAccount,
            ifsc: formData.ifsc,
            bankName: formData.bankName,
          },
          weeklySchedule
        })
      });
      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || data.message || 'Failed to submit application.');
        setLoading(false);
        return;
      }

      setSuccessMsg('Your Merchant Application has been submitted for FoodSaver verification!');
      setTimeout(() => {
        alert('Application Submitted Successfully! Your restaurant details are currently under review by the FoodSaver Admin Team.');
        navigate('/login');
      }, 1000);
    } catch (err) {
      setErrorMsg(err.message || 'Error submitting application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Menu Modal Actions
  const handleOpenEditMenu = (item) => {
    setEditingMenuItem(item);
    setMenuForm({
      name: item.name,
      description: item.description,
      price: item.price,
      discount: item.discount,
      quantity: item.quantity || '5',
      pickupStart: item.pickupStart || '20:00',
      pickupEnd: item.pickupEnd || '22:00',
      isVeg: item.isVeg,
      category: item.category,
      image: item.image
    });
    setShowMenuModal(true);
  };

  const handleSaveMenuItem = () => {
    if (!menuForm.name || !menuForm.price) {
      alert('Please enter Item Name and Original Price.');
      return;
    }
    const orig = Number(menuForm.price);
    const disc = Number(menuForm.discount || 0);
    const finalP = Math.max(0, orig - disc);

    if (editingMenuItem) {
      setFormData(prev => ({
        ...prev,
        menuItems: prev.menuItems.map(item => item.id === editingMenuItem.id ? {
          ...item,
          name: menuForm.name,
          description: menuForm.description,
          price: orig,
          discount: disc,
          finalPrice: finalP,
          quantity: Number(menuForm.quantity) || 5,
          pickupStart: menuForm.pickupStart,
          pickupEnd: menuForm.pickupEnd,
          isVeg: menuForm.isVeg,
          category: menuForm.category,
          image: menuForm.image || IMAGE_PRESETS[0].url
        } : item)
      }));
    } else {
      const newItem = {
        id: `item_${Date.now()}`,
        name: menuForm.name,
        description: menuForm.description,
        price: orig,
        discount: disc,
        finalPrice: finalP,
        quantity: Number(menuForm.quantity) || 5,
        pickupStart: menuForm.pickupStart,
        pickupEnd: menuForm.pickupEnd,
        isVeg: menuForm.isVeg,
        category: menuForm.category,
        image: menuForm.image || IMAGE_PRESETS[0].url,
        active: true
      };
      setFormData(prev => ({ ...prev, menuItems: [...prev.menuItems, newItem] }));
    }
    setShowMenuModal(false);
    setEditingMenuItem(null);
  };

  const handleDeleteMenuItem = (itemId) => {
    setFormData(prev => ({ ...prev, menuItems: prev.menuItems.filter(i => i.id !== itemId) }));
  };

  // Real Progress calculation based on completed required criteria
  const calculateProgress = () => {
    let score = 0;
    if (formData.fullName && formData.email && formData.phone) score += 15;
    if (formData.businessName && formData.businessType) score += 15;
    if (formData.buildingNumber || formData.city) score += 15;
    if (formData.documents.length > 0) score += 15;
    if (formData.openingTime && formData.closingTime) score += 10;
    if (formData.menuItems.length > 0) score += 15;
    if (formData.accountHolderName && formData.bankAccount) score += 10;
    if (formData.declarationAccepted) score += 5;
    return Math.min(100, score);
  };

  const progressPercentage = calculateProgress();
  const estMinutesRemaining = Math.max(1, Math.ceil((100 - progressPercentage) / 7));

  // Password requirements calculation
  const hasMinLength = formData.password.length >= 8;
  const hasNumber = /[0-9]/.test(formData.password);
  const hasSpecial = /[^A-Za-z0-9]/.test(formData.password);

  return (
    <div className="min-h-screen bg-[#F7F9F7] text-[#1F2933] flex flex-col font-sans selection:bg-[#2E7D32] selection:text-white">
      
      {/* 1. TOP HEADER */}
      <header className="bg-white border-b border-[#E1E7E1] px-4 sm:px-8 py-3.5 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <img src="/logo.png" alt="FoodSaver" className="h-9 w-9 rounded-xl object-contain shadow-xs" />
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xl font-black text-[#1F2933] tracking-tight">FoodSaver</span>
                <span className="text-[11px] font-semibold text-[#2E7D32] bg-emerald-50 border border-emerald-200/80 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Merchant
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={saveDraft}
              disabled={draftSaving}
              className="px-4 py-2 bg-white hover:bg-emerald-50/50 text-[#1F2933] border border-[#E1E7E1] rounded-[9px] text-xs font-semibold transition flex items-center space-x-1.5 h-[38px]"
            >
              <Save className={`h-3.5 w-3.5 text-[#2E7D32] ${draftSaving ? 'animate-spin' : ''}`} />
              <span>{draftSaving ? 'Saving...' : 'Save Draft'}</span>
            </button>

            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-xs font-semibold text-[#6B7280] hover:text-[#1F2933] hover:bg-slate-100 rounded-[9px] transition flex items-center space-x-1.5 h-[38px]"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Exit</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. WELCOME AREA */}
      <section className="bg-white border-b border-[#E1E7E1] px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center space-x-1.5 bg-emerald-50 border border-emerald-200/80 px-2.5 py-0.5 rounded-full text-[11px] font-bold text-[#2E7D32] uppercase tracking-widest mb-1.5">
              <span>JOIN FOOD SAVER PARTNERS</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-[#1F2933] tracking-tight">
              Turn surplus food into extra revenue.
            </h1>
            <p className="text-xs sm:text-sm text-[#6B7280] mt-1 max-w-2xl leading-relaxed">
              Complete your business profile to start listing surplus food for customers nearby.
            </p>
          </div>

          <div className="hidden lg:flex items-center space-x-2 bg-[#F7F9F7] border border-[#E1E7E1] px-3.5 py-2 rounded-xl text-xs text-[#6B7280] font-medium shrink-0">
            <ShieldCheck className="h-4 w-4 text-[#2E7D32]" />
            <span>Encrypted & Safe Partner Registration</span>
          </div>
        </div>
      </section>

      {/* COMPACT MOBILE PROGRESS BANNER (< 768px) */}
      <div className="md:hidden bg-white border-b border-[#E1E7E1] px-4 py-3.5 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-[#1F2933]">
          <span>Step {currentStep} of 8: {STEPS[currentStep - 1].title}</span>
          <span className="text-[#2E7D32] font-mono">{progressPercentage}%</span>
        </div>
        <div className="w-full bg-[#E1E7E1]/60 rounded-full h-2 overflow-hidden">
          <div
            className="bg-[#2E7D32] h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {/* 3. MAIN DASHBOARD CONTENT AREA */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 md:p-8 flex flex-col md:flex-row gap-8">
        
        {/* DESKTOP LEFT ONBOARDING NAVIGATION SIDEBAR */}
        <aside className="hidden md:block w-64 shrink-0 space-y-4">
          <div className="bg-white rounded-2xl border border-[#E1E7E1] p-4 shadow-xs sticky top-24 space-y-4">
            <div className="px-2 pt-1 pb-2 border-b border-[#E1E7E1]/60">
              <h3 className="text-[11px] font-extrabold text-[#6B7280] uppercase tracking-widest">
                YOUR ONBOARDING
              </h3>
            </div>

            {/* Vertical Stepper Item List */}
            <div className="space-y-1 relative">
              {STEPS.map((step) => {
                const isCurrent = currentStep === step.id;
                const isCompleted = currentStep > step.id;

                return (
                  <div
                    key={step.id}
                    onClick={() => (isCompleted || isCurrent) && setCurrentStep(step.id)}
                    className={`relative flex items-center space-x-3 py-2.5 px-3 rounded-xl transition-all ${
                      isCurrent
                        ? 'bg-emerald-50/90 text-[#2E7D32] font-bold border border-emerald-200/80'
                        : isCompleted
                        ? 'text-[#1F2933] hover:bg-[#F7F9F7] cursor-pointer font-semibold'
                        : 'text-[#9CA3AF]'
                    }`}
                  >
                    {/* Active Indicator Bar */}
                    {isCurrent && (
                      <div className="absolute left-0 top-2 bottom-2 w-1 bg-[#2E7D32] rounded-r-full" />
                    )}

                    <div className={`h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      isCurrent
                        ? 'bg-[#2E7D32] text-white shadow-xs'
                        : isCompleted
                        ? 'bg-emerald-100 text-[#2E7D32]'
                        : 'bg-slate-100 text-[#9CA3AF]'
                    }`}>
                      {isCompleted ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : step.num}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className={`text-xs leading-none ${isCurrent ? 'font-bold text-[#2E7D32]' : isCompleted ? 'font-semibold text-[#1F2933]' : 'font-medium text-[#6B7280]'}`}>
                        {step.title}
                      </p>
                      <p className="text-[10px] text-[#6B7280] truncate mt-1">{step.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* SIDEBAR PROGRESS SUMMARY */}
            <div className="pt-4 border-t border-[#E1E7E1]/60 space-y-2 px-1">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-[#6B7280]">{progressPercentage}% Complete</span>
                <span className="text-[#2E7D32] text-[11px]">Step {currentStep} of 8</span>
              </div>
              <div className="w-full bg-[#E1E7E1]/60 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-[#2E7D32] h-full transition-all duration-300 rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-[#6B7280]">
                Step {currentStep} of 8 · About {estMinutesRemaining} min
              </p>
            </div>
          </div>
        </aside>

        {/* 4. MAIN FORM CARD */}
        <section className="flex-1 bg-white rounded-2xl border border-[#E1E7E1] p-6 md:p-8 shadow-xs flex flex-col justify-between min-h-[540px]">
          <div>
            {/* Step Card Header */}
            <div className="pb-5 mb-6 border-b border-[#E1E7E1]/60 flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-extrabold text-[#1F2933] tracking-tight">
                  {STEPS[currentStep - 1].title}
                </h2>
                <p className="text-xs md:text-sm text-[#6B7280] font-medium mt-1">
                  {STEPS[currentStep - 1].formSubtitle}
                </p>
              </div>

              <div className="hidden sm:block">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-[#2E7D32]">
                  {React.createElement(STEPS[currentStep - 1].icon, { className: "h-5 w-5" })}
                </div>
              </div>
            </div>

            {/* Notification Alert Messages */}
            {errorMsg && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs md:text-sm flex items-center space-x-2.5 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}
            {successMsg && (
              <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-[#2E7D32] text-xs md:text-sm flex items-center space-x-2.5 font-medium">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* STEP 1: OWNER DETAILS */}
            {currentStep === 1 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">
                      Full Legal Owner Name *
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => handleInputChange('fullName', e.target.value)}
                      placeholder="e.g. Samar Subbiah"
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15 transition h-[50px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">
                      Official Email *
                    </label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="owner@restaurant.com"
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15 transition h-[50px]"
                    />
                  </div>
                </div>

                {/* Mobile & OTP */}
                <div>
                  <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">
                    Mobile Number *
                  </label>
                  <div className="flex space-x-2">
                    <div className="flex items-center border border-[#DDE3DD] rounded-[9px] overflow-hidden flex-1 h-[50px] bg-white focus-within:border-[#2E7D32] focus-within:ring-2 focus-within:ring-[#2E7D32]/15">
                      <span className="bg-[#F7F9F7] text-[#6B7280] text-sm font-semibold px-3.5 py-3 border-r border-[#DDE3DD]">
                        +91
                      </span>
                      <input
                        type="text"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        placeholder="9876543210"
                        className="w-full px-3 text-[15px] text-[#1F2933] font-medium focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      className="px-5 bg-white hover:bg-emerald-50 text-[#2E7D32] border border-[#2E7D32] rounded-[9px] text-xs font-bold transition h-[50px] whitespace-nowrap"
                    >
                      {otpSent ? 'Resend OTP' : 'Send OTP'}
                    </button>
                  </div>
                </div>

                {/* OTP Verification UI */}
                {otpSent && (
                  <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-[12px] p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-[#2E7D32]">Mobile verification</h4>
                        <p className="text-[11px] text-[#6B7280]">Enter the 6-digit code sent to your mobile number.</p>
                      </div>
                      <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-emerald-200 text-[#2E7D32]">Test Code: 123456</span>
                    </div>

                    {otpVerified ? (
                      <div className="flex items-center space-x-2 text-xs font-bold text-[#2E7D32]">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>✓ Mobile verified</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-3">
                        <input
                          type="text"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value)}
                          placeholder="1 2 3 4 5 6"
                          maxLength={6}
                          className="w-36 bg-white border border-[#DDE3DD] rounded-[9px] px-3 py-2.5 text-center text-base font-mono tracking-widest font-bold text-[#1F2933] focus:outline-none focus:border-[#2E7D32]"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          className="px-4 py-2.5 bg-[#2E7D32] text-white text-xs font-bold rounded-[9px] hover:bg-[#256629] transition"
                        >
                          Verify OTP
                        </button>
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          className="text-[11px] text-[#6B7280] hover:text-[#2E7D32] underline"
                        >
                          Didn't receive it? Resend OTP
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Password Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-1">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">
                      Account Password *
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={formData.password}
                        onChange={(e) => handleInputChange('password', e.target.value)}
                        placeholder="Create strong password"
                        className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 pr-10 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15 transition h-[50px]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-3.5 text-[#6B7280] hover:text-[#1F2933]"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>

                    {/* Password Requirements Checklist */}
                    <div className="mt-2.5 space-y-1 text-xs">
                      <div className="flex items-center space-x-1.5">
                        <span className={hasMinLength ? 'text-[#2E7D32] font-bold' : 'text-[#6B7280]'}>
                          {hasMinLength ? '✓' : '○'} At least 8 characters
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className={hasNumber ? 'text-[#2E7D32] font-bold' : 'text-[#6B7280]'}>
                          {hasNumber ? '✓' : '○'} One number
                        </span>
                      </div>
                      <div className="flex items-center space-x-1.5">
                        <span className={hasSpecial ? 'text-[#2E7D32] font-bold' : 'text-[#6B7280]'}>
                          {hasSpecial ? '✓' : '○'} One special character
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">
                      Confirm Password *
                    </label>
                    <input
                      type="password"
                      value={formData.confirmPassword}
                      onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
                      placeholder="Re-enter password"
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15 transition h-[50px]"
                    />
                  </div>
                </div>

                {/* Subtle Information Box */}
                <div className="mt-4 p-4 rounded-[12px] bg-emerald-50/60 border border-emerald-200/70 text-[#1F2933] space-y-1">
                  <h4 className="text-xs font-bold text-[#2E7D32] flex items-center space-x-1.5">
                    <Info className="h-3.5 w-3.5" />
                    <span>Why do we need this?</span>
                  </h4>
                  <p className="text-xs text-[#6B7280] leading-relaxed">
                    Your details help FoodSaver verify your business and keep the marketplace safe for customers and merchants.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 2: BUSINESS PROFILE */}
            {currentStep === 2 && (
              <div className="space-y-5">
                <div>
                  <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">
                    Restaurant / Business Name *
                  </label>
                  <input
                    type="text"
                    value={formData.businessName}
                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                    placeholder="e.g. Hotel Samar / Green Leaf Kitchen"
                    className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] focus:ring-2 focus:ring-[#2E7D32]/15 transition h-[50px]"
                  />
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1F2933] mb-2.5">
                    Business Type *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {BUSINESS_TYPES.map((b) => {
                      const BIcon = b.icon;
                      const isSelected = formData.businessType === b.id;
                      return (
                        <div
                          key={b.id}
                          onClick={() => handleInputChange('businessType', b.id)}
                          className={`p-3.5 rounded-[12px] border cursor-pointer transition ${
                            isSelected
                              ? 'bg-emerald-50/90 border-[#2E7D32] text-[#2E7D32]'
                              : 'bg-white border-[#DDE3DD] text-[#6B7280] hover:border-slate-300'
                          }`}
                        >
                          <BIcon className={`h-5 w-5 mb-1.5 ${isSelected ? 'text-[#2E7D32]' : 'text-slate-400'}`} />
                          <h4 className="text-xs font-bold text-[#1F2933]">{b.name}</h4>
                          <p className="text-[10px] text-[#6B7280] mt-0.5">{b.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1F2933] mb-2">
                    Cuisine Specialties
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CUISINE_OPTIONS.map((c) => {
                      const isSelected = formData.cuisine.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          onClick={() => toggleCuisine(c)}
                          className={`px-3 py-1.5 rounded-[8px] text-xs font-bold border transition ${
                            isSelected
                              ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                              : 'bg-[#F7F9F7] text-[#1F2933] border-[#DDE3DD] hover:border-slate-300'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}{c}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Year Established</label>
                    <input
                      type="number"
                      value={formData.yearEstablished}
                      onChange={(e) => handleInputChange('yearEstablished', e.target.value)}
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Seating Capacity</label>
                    <input
                      type="number"
                      value={formData.seatingCapacity}
                      onChange={(e) => handleInputChange('seatingCapacity', e.target.value)}
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Food Type Offered</label>
                    <select
                      value={formData.foodType}
                      onChange={(e) => handleInputChange('foodType', e.target.value)}
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    >
                      <option value="Vegetarian">Pure Vegetarian 🟢</option>
                      <option value="Non-Vegetarian">Non-Vegetarian Only 🔴</option>
                      <option value="Both">Both (Veg & Non-Veg)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Short Description</label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    placeholder="Describe your kitchen specialties and food surplus rescue offers..."
                    className="w-full bg-white border border-[#DDE3DD] rounded-[9px] p-3.5 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32]"
                  />
                </div>
              </div>
            )}

            {/* STEP 3: LOCATION & GPS */}
            {currentStep === 3 && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 rounded-[12px] bg-[#F7F9F7] border border-[#DDE3DD] gap-3">
                  <div className="flex items-center space-x-3">
                    <Compass className="h-5 w-5 text-[#2E7D32] shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-[#1F2933]">Auto Detect Location</h4>
                      <p className="text-[11px] text-[#6B7280]">Fetch exact GPS coordinates via browser sensors</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGeocodeAddress}
                      disabled={detectingGps}
                      className="px-3.5 py-2 bg-white border border-[#DDE3DD] rounded-[9px] text-xs font-bold text-[#1F2933] hover:bg-slate-100 transition flex items-center space-x-1.5 shadow-xs"
                      title="Convert typed address to real coordinates"
                    >
                      <span>🔍</span>
                      <span>Geocode Address</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleDetectLocation}
                      disabled={detectingGps}
                      className="px-3.5 py-2 bg-[#2E7D32] hover:bg-[#256629] text-white border border-[#2E7D32] rounded-[9px] text-xs font-bold transition flex items-center space-x-1.5 shadow-sm active:scale-95"
                      title="Use device GPS location"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${detectingGps ? 'animate-spin' : ''}`} />
                      <span>{detectingGps ? 'Detecting...' : '📍 Use My Current Location'}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left: Address Fields */}
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Door / Building Number *</label>
                      <input
                        type="text"
                        value={formData.buildingNumber}
                        onChange={(e) => handleInputChange('buildingNumber', e.target.value)}
                        placeholder="Door No. 42A, 1st Floor"
                        className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                      />
                    </div>
                    <div>
                      <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Street Name / Landmark</label>
                      <input
                        type="text"
                        value={formData.street}
                        onChange={(e) => handleInputChange('street', e.target.value)}
                        placeholder="Main Road / Near Bus Stand"
                        className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">City *</label>
                        <input
                          type="text"
                          value={formData.city}
                          onChange={(e) => handleInputChange('city', e.target.value)}
                          className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Pincode *</label>
                        <input
                          type="text"
                          value={formData.pincode}
                          onChange={(e) => handleInputChange('pincode', e.target.value)}
                          placeholder="628501"
                          className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3 text-[15px] font-mono text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Latitude (Real GPS / SQL)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={formData.latitude}
                          onChange={(e) => handleInputChange('latitude', parseFloat(e.target.value))}
                          className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3 text-[15px] font-mono text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                        />
                      </div>
                      <div>
                        <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Longitude (Real GPS / SQL)</label>
                        <input
                          type="number"
                          step="0.0001"
                          value={formData.longitude}
                          onChange={(e) => handleInputChange('longitude', parseFloat(e.target.value))}
                          className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3 text-[15px] font-mono text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                        />
                      </div>
                    </div>

                    {/* Customer Notification Radius */}
                    <div className="p-3.5 bg-emerald-50/60 border border-emerald-200/80 rounded-[12px] space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold text-[#2E7D32]">
                        <span>Customer Notification Radius</span>
                        <span className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-emerald-200">
                          {formData.notificationRadius || 2.0} km
                        </span>
                      </div>
                      <p className="text-[11px] text-[#6B7280] leading-relaxed">
                        Customers within this radius will receive instant alerts when you publish surplus food offers.
                      </p>
                    </div>
                  </div>

                  {/* Right: Real Leaflet Map Preview */}
                  <div className="h-full min-h-[300px] flex flex-col space-y-2">
                    <label className="block text-[14px] font-medium text-[#1F2933]">
                      Real Leaflet Map Location Preview
                    </label>
                    <div className="flex-1 w-full rounded-2xl overflow-hidden border border-[#DDE3DD] min-h-[300px] relative">
                      <RealMap
                        userLocation={{
                          latitude: formData.latitude,
                          longitude: formData.longitude,
                          address: formData.street || formData.city || "Store Location",
                        }}
                        merchants={[
                          {
                            id: "merchant-preview",
                            businessName: formData.businessName || "Your Store",
                            address: `${formData.buildingNumber || ""} ${formData.street || ""} ${formData.city || ""}`.trim() || "Store Location",
                            latitude: formData.latitude,
                            longitude: formData.longitude,
                            distance: 0,
                          },
                        ]}
                        radiusKm={formData.notificationRadius || 2.0}
                        style={{ height: "300px", width: "100%" }}
                        className="w-full h-full min-h-[300px] rounded-2xl overflow-hidden border border-slate-700/60 shadow-inner relative"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: VERIFICATION DOCUMENTS */}
            {currentStep === 4 && (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">FSSAI License Number *</label>
                    <input
                      type="text"
                      value={formData.fssaiNumber}
                      onChange={(e) => handleInputChange('fssaiNumber', e.target.value)}
                      placeholder="14 digit FSSAI license number"
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] font-mono text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">GSTIN Number (Optional)</label>
                    <input
                      type="text"
                      value={formData.gstin}
                      onChange={(e) => handleInputChange('gstin', e.target.value)}
                      placeholder="33AAAAA0000A1Z5"
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] font-mono uppercase text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    />
                  </div>
                </div>

                {/* Upload Dropzone UI */}
                <div className="space-y-4">
                  <h3 className="text-xs font-bold text-[#1F2933] uppercase tracking-wider">Upload Verification Documents</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {['FSSAI License Certificate', 'GST / Business Registration'].map((docType) => {
                      return (
                        <div key={docType} className="border border-dashed border-[#DDE3DD] rounded-[12px] p-5 bg-[#F7F9F7]/60 hover:bg-slate-50 transition text-center space-y-3 relative">
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            onChange={(e) => handleFileUpload(docType, e)}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          />
                          <div className="h-10 w-10 mx-auto rounded-full bg-emerald-50 text-[#2E7D32] flex items-center justify-center">
                            <UploadCloud className="h-5 w-5" />
                          </div>
                          <div>
                            <h4 className="text-xs font-bold text-[#1F2933]">{docType}</h4>
                            <p className="text-[11px] text-[#6B7280] mt-0.5">
                              {uploadingDocType === docType ? 'Uploading document...' : 'Drag & drop or click to upload'}
                            </p>
                            <span className="text-[10px] text-slate-400 block mt-1">PDF, JPG, PNG • Max 10 MB</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Uploaded Documents List */}
                  <div className="border border-[#DDE3DD] rounded-[12px] p-4 bg-white space-y-3">
                    <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">Uploaded Documents ({formData.documents.length})</h4>
                    <div className="space-y-2">
                      {formData.documents.map((doc, idx) => (
                        <div key={idx} className="p-3 bg-[#F7F9F7] border border-slate-200/80 rounded-[9px] flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <File className="h-4 w-4 text-[#2E7D32]" />
                            <div>
                              <p className="text-xs font-bold text-[#1F2933]">{doc.type}</p>
                              <p className="text-[11px] text-[#6B7280] font-mono">{doc.file} • {doc.size || '1.2 MB'}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-bold text-[#2E7D32] bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              ✓ {doc.status || 'Uploaded'}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveDoc(doc.type)}
                              className="text-xs text-rose-600 hover:underline font-semibold"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: OPERATING HOURS */}
            {currentStep === 5 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-[#E1E7E1]/60">
                  <div>
                    <h3 className="text-sm font-bold text-[#1F2933]">Weekly Operating Schedule</h3>
                    <p className="text-xs text-[#6B7280]">Configure store operating hours for customer pickup</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyMondaySchedule}
                    className="px-3 py-1.5 bg-emerald-50 text-[#2E7D32] border border-emerald-200 text-xs font-bold rounded-[8px] hover:bg-emerald-100 transition"
                  >
                    Copy Monday to All Days
                  </button>
                </div>

                {/* Weekly Schedule Rows */}
                <div className="space-y-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const sched = weeklySchedule[day] || { open: true, openingTime: '10:00', closingTime: '22:30' };

                    return (
                      <div key={day} className="p-3 bg-white border border-[#DDE3DD] rounded-[9px] flex items-center justify-between text-xs gap-3">
                        <div className="w-28 font-bold text-[#1F2933] flex items-center space-x-2">
                          <input
                            type="checkbox"
                            checked={sched.open}
                            onChange={(e) => setWeeklySchedule(prev => ({
                              ...prev,
                              [day]: { ...sched, open: e.target.checked }
                            }))}
                            className="rounded border-slate-300 text-[#2E7D32] focus:ring-[#2E7D32]"
                          />
                          <span>{day}</span>
                        </div>

                        {sched.open ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="time"
                              value={sched.openingTime}
                              onChange={(e) => setWeeklySchedule(prev => ({
                                ...prev,
                                [day]: { ...sched, openingTime: e.target.value }
                              }))}
                              className="bg-[#F7F9F7] border border-slate-200 rounded px-2 py-1 text-xs text-[#1F2933]"
                            />
                            <span className="text-slate-400">—</span>
                            <input
                              type="time"
                              value={sched.closingTime}
                              onChange={(e) => setWeeklySchedule(prev => ({
                                ...prev,
                                [day]: { ...sched, closingTime: e.target.value }
                              }))}
                              className="bg-[#F7F9F7] border border-slate-200 rounded px-2 py-1 text-xs text-[#1F2933]"
                            />
                            <span className="text-[10px] font-bold text-[#2E7D32] bg-emerald-50 px-2 py-0.5 rounded">Open</span>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-500 font-bold bg-rose-50 px-3 py-1 rounded">Closed</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Avg Prep Time (Mins)</label>
                    <input
                      type="number"
                      value={formData.averagePrepTime}
                      onChange={(e) => handleInputChange('averagePrepTime', e.target.value)}
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Minimum Order Amount (₹)</label>
                    <input
                      type="number"
                      value={formData.minimumOrderAmount}
                      onChange={(e) => handleInputChange('minimumOrderAmount', e.target.value)}
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] font-mono text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Delivery Radius (km)</label>
                    <input
                      type="number"
                      value={formData.deliveryRadius}
                      onChange={(e) => handleInputChange('deliveryRadius', e.target.value)}
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] font-mono text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1F2933] mb-2">Restaurant Amenities</label>
                  <div className="flex flex-wrap gap-2">
                    {['Air Conditioned', 'Free WiFi', 'Dedicated Parking', 'Pure Veg Options', 'Outdoor Seating'].map((am) => {
                      const isSelected = formData.amenities.includes(am);
                      return (
                        <button
                          key={am}
                          type="button"
                          onClick={() => toggleAmenity(am)}
                          className={`px-3 py-1.5 rounded-[8px] text-xs font-bold border transition ${
                            isSelected
                              ? 'bg-[#2E7D32] text-white border-[#2E7D32]'
                              : 'bg-[#F7F9F7] text-[#1F2933] border-[#DDE3DD] hover:border-slate-300'
                          }`}
                        >
                          {isSelected ? '✓ ' : '+ '}{am}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 6: MENU CATALOG */}
            {currentStep === 6 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between pb-2 border-b border-[#E1E7E1]/60">
                  <div>
                    <h3 className="text-sm font-bold text-[#1F2933]">Surplus Menu Catalog ({formData.menuItems.length} Items)</h3>
                    <p className="text-xs text-[#6B7280]">Configure surplus food deals for rescue customers</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEditingMenuItem(null); setMenuForm({ name: '', description: '', price: '', discount: '', quantity: '5', pickupStart: '20:00', pickupEnd: '22:00', isVeg: true, category: 'Main Course', image: IMAGE_PRESETS[0].url }); setShowMenuModal(true); }}
                    className="px-4 py-2 bg-[#2E7D32] hover:bg-[#256629] text-white font-bold rounded-[9px] text-xs transition flex items-center space-x-1.5 shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add Food Item</span>
                  </button>
                </div>

                {/* Empty State */}
                {formData.menuItems.length === 0 ? (
                  <div className="p-8 border border-dashed border-[#DDE3DD] rounded-2xl text-center space-y-3 bg-[#F7F9F7]/50">
                    <UtensilsCrossed className="h-10 w-10 text-slate-300 mx-auto" />
                    <h4 className="text-sm font-bold text-[#1F2933]">No menu items yet</h4>
                    <p className="text-xs text-[#6B7280] max-w-sm mx-auto">
                      Add your first food item to start creating FoodSaver offers for customers in your area.
                    </p>
                    <button
                      type="button"
                      onClick={() => { setEditingMenuItem(null); setMenuForm({ name: '', description: '', price: '', discount: '', quantity: '5', pickupStart: '20:00', pickupEnd: '22:00', isVeg: true, category: 'Main Course', image: IMAGE_PRESETS[0].url }); setShowMenuModal(true); }}
                      className="px-4 py-2 bg-[#2E7D32] text-white font-bold rounded-[9px] text-xs hover:bg-[#256629] transition inline-flex items-center space-x-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      <span>Add Food Item</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {formData.menuItems.map((item) => (
                      <div key={item.id} className="p-3.5 bg-white border border-[#DDE3DD] rounded-[12px] flex items-center justify-between shadow-xs">
                        <div className="flex items-center space-x-3">
                          <img src={item.image} alt={item.name} className="h-14 w-14 rounded-lg object-cover bg-slate-100 border border-slate-200" />
                          <div>
                            <div className="flex items-center space-x-1.5">
                              <span className={`h-2 w-2 rounded-full ${item.isVeg ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                              <h4 className="text-xs font-bold text-[#1F2933]">{item.name}</h4>
                            </div>
                            <p className="text-[11px] text-[#6B7280] truncate max-w-[160px]">{item.description}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <span className="text-xs font-extrabold text-[#2E7D32] font-mono">₹{item.finalPrice}</span>
                              <span className="text-[10px] text-slate-400 line-through font-mono">₹{item.price}</span>
                              <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">Qty: {item.quantity || 5}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditMenu(item)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 transition"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMenuItem(item.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 7: BANK DETAILS */}
            {currentStep === 7 && (
              <div className="space-y-5">
                <div className="p-4 rounded-[12px] bg-emerald-50/70 border border-emerald-200 text-[#2E7D32] text-xs font-medium leading-relaxed flex items-center space-x-3">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-[#2E7D32]" />
                  <span>Payout Security: Bank details are encrypted. Weekly earnings will be credited directly to this account.</span>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">
                    Account Holder Name *
                  </label>
                  <input
                    type="text"
                    value={formData.accountHolderName}
                    onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
                    placeholder="Legal name on bank account"
                    className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Bank Account Number *</label>
                    <input
                      type="password"
                      value={formData.bankAccount}
                      onChange={(e) => handleInputChange('bankAccount', e.target.value)}
                      placeholder="Account number"
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] font-mono text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    />
                  </div>
                  <div>
                    <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">Confirm Bank Account Number *</label>
                    <input
                      type="text"
                      value={formData.confirmBankAccount}
                      onChange={(e) => handleInputChange('confirmBankAccount', e.target.value)}
                      placeholder="Re-enter account number"
                      className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] font-mono text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[14px] font-medium text-[#1F2933] mb-1.5">IFSC Code *</label>
                  <input
                    type="text"
                    value={formData.ifsc}
                    onChange={(e) => handleInputChange('ifsc', e.target.value)}
                    placeholder="e.g. HDFC0001234"
                    className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-4 text-[15px] font-mono uppercase text-[#1F2933] focus:outline-none focus:border-[#2E7D32] h-[50px]"
                  />
                </div>
              </div>
            )}

            {/* STEP 8: REVIEW & SUBMIT */}
            {currentStep === 8 && (
              <div className="space-y-5">
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-[12px] space-y-1">
                  <h3 className="text-xs font-bold text-[#2E7D32] uppercase tracking-wider">Review Your Application</h3>
                  <p className="text-xs text-[#6B7280]">
                    Please verify that all information is correct before submitting your merchant application.
                  </p>
                </div>

                {/* Section Review Cards with Edit Shortcuts */}
                <div className="space-y-3">
                  {/* Section 1: Owner Details */}
                  <div className="p-4 bg-[#F7F9F7] border border-[#DDE3DD] rounded-[12px] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">01 Owner Information</h4>
                      <p className="text-sm font-bold text-[#1F2933] mt-0.5">{formData.fullName || 'Not specified'}</p>
                      <p className="text-xs text-[#6B7280]">{formData.email} • {formData.phone}</p>
                    </div>
                    <button type="button" onClick={() => setCurrentStep(1)} className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-[#2E7D32] hover:bg-emerald-50">Edit</button>
                  </div>

                  {/* Section 2: Business Profile */}
                  <div className="p-4 bg-[#F7F9F7] border border-[#DDE3DD] rounded-[12px] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">02 Business Information</h4>
                      <p className="text-sm font-bold text-[#1F2933] mt-0.5">{formData.businessName || 'Not specified'}</p>
                      <p className="text-xs text-[#6B7280]">{formData.businessType} • {formData.cuisine.join(', ')}</p>
                    </div>
                    <button type="button" onClick={() => setCurrentStep(2)} className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-[#2E7D32] hover:bg-emerald-50">Edit</button>
                  </div>

                  {/* Section 3: Location */}
                  <div className="p-4 bg-[#F7F9F7] border border-[#DDE3DD] rounded-[12px] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">03 Location & Service Radius</h4>
                      <p className="text-sm font-bold text-[#1F2933] mt-0.5">{formData.buildingNumber}, {formData.city}, {formData.pincode}</p>
                      <p className="text-xs text-[#6B7280]">GPS: {formData.latitude}, {formData.longitude} • Radius: {formData.notificationRadius || 2.0} km</p>
                    </div>
                    <button type="button" onClick={() => setCurrentStep(3)} className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-[#2E7D32] hover:bg-emerald-50">Edit</button>
                  </div>

                  {/* Section 4: Documents */}
                  <div className="p-4 bg-[#F7F9F7] border border-[#DDE3DD] rounded-[12px] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">04 Verification Documents</h4>
                      <p className="text-sm font-bold text-[#1F2933] mt-0.5">FSSAI: {formData.fssaiNumber || '14221012000492'}</p>
                      <p className="text-xs text-[#6B7280]">{formData.documents.length} Document(s) Uploaded</p>
                    </div>
                    <button type="button" onClick={() => setCurrentStep(4)} className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-[#2E7D32] hover:bg-emerald-50">Edit</button>
                  </div>

                  {/* Section 5: Menu */}
                  <div className="p-4 bg-[#F7F9F7] border border-[#DDE3DD] rounded-[12px] flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-[#6B7280] uppercase tracking-wider">05 Menu Catalog</h4>
                      <p className="text-sm font-bold text-[#1F2933] mt-0.5">{formData.menuItems.length} Food Rescue Items Configured</p>
                    </div>
                    <button type="button" onClick={() => setCurrentStep(6)} className="px-3 py-1 bg-white border border-slate-200 rounded text-xs font-bold text-[#2E7D32] hover:bg-emerald-50">Edit</button>
                  </div>
                </div>

                {/* Important Notice Banner */}
                <div className="p-4 rounded-[12px] bg-amber-50/70 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1">
                  <div className="flex items-center space-x-2 font-bold text-amber-800">
                    <Info className="h-4 w-4 text-amber-600" />
                    <span>Admin Review Notice</span>
                  </div>
                  <p className="text-slate-700">
                    Your application will be reviewed by the FoodSaver admin team before your merchant account is activated.
                  </p>
                </div>

                {/* Declaration Checkbox */}
                <div className="p-4 rounded-[12px] bg-white border border-[#DDE3DD]">
                  <label className="flex items-start space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.declarationAccepted}
                      onChange={(e) => handleInputChange('declarationAccepted', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#2E7D32] focus:ring-[#2E7D32] mt-0.5"
                    />
                    <span className="text-xs text-slate-700 leading-relaxed font-semibold">
                      I confirm that all details provided are accurate and compliant with food safety regulations.
                    </span>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* 5. BOTTOM ACTION AREA */}
          <div className="flex items-center justify-between border-t border-[#E1E7E1]/60 pt-6 mt-8">
            <button
              type="button"
              disabled={currentStep === 1}
              onClick={handlePrevStep}
              className={`px-6 py-2.5 rounded-[9px] text-xs font-bold transition flex items-center space-x-1.5 h-[48px] ${
                currentStep === 1
                  ? 'opacity-30 cursor-not-allowed bg-slate-100 text-slate-400'
                  : 'bg-[#F7F9F7] hover:bg-slate-200 text-[#1F2933] border border-[#DDE3DD]'
              }`}
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <div className="flex items-center space-x-3">
              {currentStep < 8 ? (
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={loading}
                  className="px-7 py-2.5 bg-[#2E7D32] hover:bg-[#256629] text-white font-bold rounded-[9px] text-xs transition shadow-xs flex items-center space-x-1.5 h-[48px]"
                >
                  <span>{loading ? 'Saving...' : 'Continue'}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmitOnboarding}
                  disabled={loading}
                  className="px-7 py-2.5 bg-[#2E7D32] hover:bg-[#256629] text-white font-bold rounded-[9px] text-xs transition shadow-md flex items-center space-x-1.5 uppercase tracking-wider h-[48px]"
                >
                  <span>{loading ? 'Saving...' : 'Submit Application'}</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* 12. SUPPORT / FOOTER */}
      <footer className="bg-white border-t border-[#E1E7E1] py-4 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs text-[#6B7280] gap-2">
          <span>FoodSaver Merchant Platform © 2026</span>
          <div className="flex items-center space-x-3">
            <span>Need help? Contact FoodSaver Merchant Support:</span>
            <a href="mailto:partner-support@foodsaver.com" className="text-[#2E7D32] hover:underline font-semibold">Email</a>
            <span>|</span>
            <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer" className="text-[#2E7D32] hover:underline font-semibold">WhatsApp</a>
          </div>
        </div>
      </footer>

      {/* MENU ITEM MODAL */}
      {showMenuModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-[#E1E7E1] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-[#1F2933]">{editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
            
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#1F2933] mb-1">Item Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Special Dum Biryani"
                  value={menuForm.name}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3.5 py-2 text-[#1F2933] font-medium text-sm focus:outline-none focus:border-[#2E7D32]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#1F2933] mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Short description of ingredients/flavor"
                  value={menuForm.description}
                  onChange={(e) => setMenuForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3.5 py-2 text-[#1F2933] font-medium text-sm focus:outline-none focus:border-[#2E7D32]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1F2933] mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    placeholder="240"
                    value={menuForm.price}
                    onChange={(e) => setMenuForm(prev => ({ ...prev, price: e.target.value }))}
                    className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3.5 py-2 text-[#1F2933] font-mono font-bold text-sm focus:outline-none focus:border-[#2E7D32]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1F2933] mb-1">Discount (₹)</label>
                  <input
                    type="number"
                    placeholder="60"
                    value={menuForm.discount}
                    onChange={(e) => setMenuForm(prev => ({ ...prev, discount: e.target.value }))}
                    className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3.5 py-2 text-[#1F2933] font-mono font-bold text-sm focus:outline-none focus:border-[#2E7D32]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-[#1F2933] mb-1">Available Qty</label>
                  <input
                    type="number"
                    value={menuForm.quantity}
                    onChange={(e) => setMenuForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3.5 py-2 text-[#1F2933] font-mono font-bold text-sm focus:outline-none focus:border-[#2E7D32]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#1F2933] mb-1">Category</label>
                  <select
                    value={menuForm.category}
                    onChange={(e) => setMenuForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-white border border-[#DDE3DD] rounded-[9px] px-3 py-2 text-[#1F2933] text-sm focus:outline-none focus:border-[#2E7D32]"
                  >
                    <option value="Main Course">Main Course</option>
                    <option value="Starters & Snacks">Starters & Snacks</option>
                    <option value="Desserts & Sweets">Desserts & Sweets</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center space-x-6 pt-1">
                <label className="flex items-center space-x-2 text-xs font-bold text-[#1F2933] cursor-pointer">
                  <input
                    type="radio"
                    name="vegType"
                    checked={menuForm.isVeg}
                    onChange={() => setMenuForm(prev => ({ ...prev, isVeg: true }))}
                    className="text-[#2E7D32] focus:ring-[#2E7D32]"
                  />
                  <span>Vegetarian 🟢</span>
                </label>
                <label className="flex items-center space-x-2 text-xs font-bold text-[#1F2933] cursor-pointer">
                  <input
                    type="radio"
                    name="vegType"
                    checked={!menuForm.isVeg}
                    onChange={() => setMenuForm(prev => ({ ...prev, isVeg: false }))}
                    className="text-rose-600 focus:ring-rose-600"
                  />
                  <span>Non-Vegetarian 🔴</span>
                </label>
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-[#E1E7E1]/60">
              <button
                type="button"
                onClick={() => setShowMenuModal(false)}
                className="px-4 py-2 bg-slate-100 text-[#1F2933] rounded-[9px] text-xs font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveMenuItem}
                className="px-4 py-2 bg-[#2E7D32] text-white font-bold rounded-[9px] text-xs hover:bg-[#256629] transition"
              >
                Save Item
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

