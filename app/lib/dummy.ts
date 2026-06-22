export const navItems = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/appointments', label: 'Appointments' },
  { href: '/patients', label: 'Patients' },
  { href: '/chats', label: 'Chats' },
  { href: '/profile', label: 'Profile' },
];

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
  title: 'Healthcare Professional (HCP)',
  facility: 'Kumasi South Hospital',
  ghanaCard: 'GHA-XXXXXXX-7421',
  email: 'adwoa.owusu@zomujo.health',
  patients: 137,
  verified: true,
};
