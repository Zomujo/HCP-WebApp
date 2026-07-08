export const getHealthWorkerNavItems = () => [
  { href: '/dashboard', label: 'Overview' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/patients', label: 'Patients' },
  { href: '/chats', label: 'Chats' },
  { href: '/profile', label: 'Profile' },
];

export const getPharmacyNavItems = () => [
  { href: '/pharmacy/dashboard', label: 'Dashboard' },
  { href: '/pharmacy/prescriptions', label: 'Prescriptions' },
  { href: '/pharmacy/patients', label: 'Patients' },
  { href: '/pharmacy/inventory', label: 'Inventory' },
  { href: '/pharmacy/dispensing', label: 'Dispensing' },
  { href: '/pharmacy/chats', label: 'Chats' },
];

export const navItems = getHealthWorkerNavItems();

export const patientList = [
  { id: 'akua-mensah', name: 'Akua Mensah', initials: 'AM', age: 62, condition: 'Hypertension', lastCheckIn: '2h ago', adherence: '64%', status: 'Critical' },
  { id: 'kwame-asare', name: 'Kwame Asare', initials: 'KA', age: 58, condition: 'Diabetes', lastCheckIn: '1d ago', adherence: '52%', status: 'Critical' },
  { id: 'yaa-owusu', name: 'Yaa Owusu', initials: 'YO', age: 54, condition: 'Diabetes', lastCheckIn: '3d ago', adherence: '78%', status: 'Silent' },
  { id: 'ato-boateng', name: 'Ato Boateng', initials: 'AB', age: 67, condition: 'Both', lastCheckIn: '2d ago', adherence: '81%', status: 'Silent' },
  { id: 'auntie-ama', name: 'Auntie Ama Boateng', initials: 'AA', age: 71, condition: 'Both', lastCheckIn: '3h ago', adherence: '92%', status: 'Stable' },
  { id: 'esi-tetteh', name: 'Esi Tetteh', initials: 'ET', age: 49, condition: 'Hypertension', lastCheckIn: '5h ago', adherence: '88%', status: 'Stable' },
  { id: 'kofi-owusu', name: 'Kofi Owusu', initials: 'KO', age: 63, condition: 'Hypertension', lastCheckIn: '1h ago', adherence: '70%', status: 'Caution' },
  { id: 'joseph-mensah', name: 'JM', initials: 'JM', age: 55, condition: 'Diabetes', lastCheckIn: '8h ago', adherence: '85%', status: 'Stable' },
];

export const dashboardStats = [
  { label: 'Total Patients', value: '1,240' },
  { label: 'Critical Readings', value: '8' },
  { label: 'Silent Patients', value: '4' },
];

export const weeklyAppointments = [
  { day: 'Mon', value: 2, note: '2 visits' },
  { day: 'Tue', value: 4, note: '4 visits' },
  { day: 'Wed', value: 3, note: '3 visits', active: true },
  { day: 'Thu', value: 1, note: '1 visit' },
  { day: 'Fri', value: 0, note: 'No visits' },
  { day: 'Sat', value: 0, note: 'No visits' },
  { day: 'Sun', value: 0, note: 'No visits' },
];

export const recentReadings = [
  { name: 'Akua Mensah', age: 62, condition: 'Hypertension', lastCheckIn: '2h ago', adherence: '64%', status: 'Critical' },
  { name: 'Kwame Asare', age: 58, condition: 'Diabetes', lastCheckIn: '1d ago', adherence: '52%', status: 'Critical' },
  { name: 'Yaa Owusu', age: 54, condition: 'Diabetes', lastCheckIn: '3d ago', adherence: '78%', status: 'Silent' },
];

export const appointments = [
  { id: 'appt-1', patient: 'Akua Mensah', time: 'Wed 3 Jun • 09:00 • Clinic', note: 'BP review — bring your diary.' },
  { id: 'appt-2', patient: 'Akua Mensah', time: 'Mon 8 Jun • 14:00 • Phone', note: 'Adherence check-in call.' },
  { id: 'appt-3', patient: 'Akua Mensah', time: 'Mon 13 May • 09:30 • Clinic', note: 'Medication review.' },
];

export const chatThreads = [
  { id: 'thread-1', name: 'Akua Mensah', latest: 'I feel dizzy after the new medicine.', time: '1h' },
  { id: 'thread-2', name: 'Kwame Asare', latest: 'Can I take the tablet with food?', time: '3h' },
  { id: 'thread-3', name: 'Auntie Ama Boateng', latest: 'Thank you. I will drink water then.', time: '12m' },
  { id: 'thread-4', name: 'Esi Tetteh', latest: 'Reading was 138/86 this morning.', time: 'Yesterday' },
];

export const patientDetail = {
  name: 'Akua Mensah',
  initials: 'AM',
  age: 62,
  condition: 'Hypertension',
  joined: 'Jan 2025',
  facility: 'Kumasi South Hospital',
  ghanaCard: 'GHA-XXXXXXX-3140',
  nhis: '9921-4477-02',
  adherence: '64%',
  criticalReadings: 3,
  assigned: true,
  vitals: { systolic: 168, diastolic: 102, note: 'Today 07:42 • AI check-in' },
  medication: [
    { name: 'Amlodipine 5mg', dose: '1 tablet, every morning', adherence: '71%' },
    { name: 'Hydrochlorothiazide 25mg', dose: '1 tablet, every morning', adherence: '57%' },
  ],
  readings: [
    { value: '168 / 102', note: 'Critical', time: 'Today 07:42' },
    { value: '161 / 98', note: 'Yesterday 09:42' },
    { value: '152 / 94', note: 'Wednesday 11:25' },
    { value: '145 / 91', note: 'Tuesday 08:14' },
    { value: '138 / 86', note: 'Today 03:27' },
  ],
  messages: [
    { type: 'from', text: 'Good morning. I took my tablet but my head is heavy.', time: '08:14' },
    { type: 'from', text: 'I feel dizzy after the new medicine.', time: '08:15' },
    { type: 'to', text: 'Thank you for letting me know. Please sit and drink water. I will call you shortly.', time: '08:22' },
  ],
};

export const profileData = {
  name: 'Adwoa Owusu',
  title: 'Health Worker',
  facility: 'Kumasi South Hospital',
  ghanaCard: 'GHA-XXXXXXX-7421',
  email: 'adwoa.owusu@zomujo.health',
  patients: 137,
  verified: true,
};

// Pharmacy-specific data
export const pharmacyDashboardStats = [
  { label: 'Pending Prescriptions', value: '24' },
  { label: 'Low Stock Items', value: '6' },
  { label: 'Dispensed Today', value: '142' },
];

export const pendingPrescriptions = [
  { id: 'rx-001', patient: 'Akua Mensah', medication: 'Amlodipine 5mg', quantity: 30, status: 'Pending', time: '2h ago', doctor: 'Dr. Ama Osei' },
  { id: 'rx-002', patient: 'Kwame Asare', medication: 'Metformin 500mg', quantity: 60, status: 'Pending', time: '1h ago', doctor: 'Dr. Kwesi Boateng' },
  { id: 'rx-003', patient: 'Yaa Owusu', medication: 'Lisinopril 10mg', quantity: 30, status: 'Ready', time: '30m ago', doctor: 'Dr. Ama Osei' },
  { id: 'rx-004', patient: 'Kofi Owusu', medication: 'Atorvastatin 20mg', quantity: 30, status: 'Pending', time: '45m ago', doctor: 'Dr. Kwesi Boateng' },
];

export const inventoryItems = [
  { id: 'inv-001', name: 'Amlodipine 5mg', stock: 150, minimum: 200, status: 'Low', unit: 'tablets' },
  { id: 'inv-002', name: 'Metformin 500mg', stock: 320, minimum: 300, status: 'Adequate', unit: 'tablets' },
  { id: 'inv-003', name: 'Lisinopril 10mg', stock: 85, minimum: 150, status: 'Low', unit: 'tablets' },
  { id: 'inv-004', name: 'Atorvastatin 20mg', stock: 210, minimum: 200, status: 'Adequate', unit: 'tablets' },
  { id: 'inv-005', name: 'Hydrochlorothiazide 25mg', stock: 45, minimum: 100, status: 'Critical', unit: 'tablets' },
  { id: 'inv-006', name: 'Aspirin 100mg', stock: 500, minimum: 300, status: 'Adequate', unit: 'tablets' },
];

export const dispensingHistory = [
  { id: 'disp-1', patient: 'Esi Tetteh', medication: 'Amlodipine 5mg', quantity: 30, doctor: 'Dr. Ama Osei', time: 'Today 09:15', status: 'Completed' },
  { id: 'disp-2', patient: 'Auntie Ama Boateng', medication: 'Metformin 500mg', quantity: 60, doctor: 'Dr. Kwesi Boateng', time: 'Today 08:45', status: 'Completed' },
  { id: 'disp-3', patient: 'Joseph Mensah', medication: 'Lisinopril 10mg', quantity: 30, doctor: 'Dr. Ama Osei', time: 'Yesterday 14:20', status: 'Completed' },
];

export const pharmacyChatThreads = [
  { id: 'phathread-1', name: 'Dr. Ama Osei', latest: 'Can we get more Amlodipine soon?', time: '1h' },
  { id: 'phathread-2', name: 'Akua Mensah', latest: 'Can I take this medication with food?', time: '3h' },
  { id: 'phathread-3', name: 'Dr. Kwesi Boateng', latest: 'Prescription for Kwame is ready for pickup', time: '12m' },
];
