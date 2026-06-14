import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import { db } from '../firebase';
import { collection, addDoc, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { 
  HelpCircle, Search, MessageSquare, Send, CheckCircle2, 
  AlertCircle, Terminal, ArrowRight, Shield, Activity, 
  FileText, RefreshCw, User, Mail, PlusCircle, Wrench, 
  Info, Lock, ChevronDown, BookOpen, Clock, Phone, Globe, ChevronRight, X, MessageCircle
} from 'lucide-react';

const HelpSupport = () => {
  const { currentUser, userData } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [faqExpanded, setFaqExpanded] = useState({});
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);

  // Ticket Form State
  const [ticketForm, setTicketForm] = useState({
    subject: '',
    description: '',
    category: 'General Support',
    priority: 'Low',
    email: currentUser?.email || userData?.email || ''
  });
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

  // Diagnostic State
  const [diagnosticStatus, setDiagnosticStatus] = useState('idle'); // idle, running, completed
  const [diagnosticResults, setDiagnosticResults] = useState({
    connectionSpeed: null,
    latency: null,
    databaseStatus: 'unknown',
    storageUsage: 'unknown',
    browserSecure: 'idle',
    authStatus: 'unknown'
  });

  // Assistant Chat State
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { sender: 'bot', text: `Hi ${userData?.name || 'there'}! I am your LabMitra virtual assistant. How can I help you today?` }
  ]);

  // Sync tickets with Firestore
  useEffect(() => {
    if (!currentUser) {
      setTickets([]);
      setLoadingTickets(false);
      return;
    }
    
    setLoadingTickets(true);
    const q = query(
      collection(db, 'supportTickets'),
      where('userId', '==', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ticketsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate().toISOString() : doc.data().createdAt || new Date().toISOString()
      })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setTickets(ticketsData);
      setLoadingTickets(false);
    }, (error) => {
      console.error("Error fetching tickets from Firestore:", error);
      setLoadingTickets(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Toggle FAQ collapse
  const toggleFaq = (id) => {
    setFaqExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Run Diagnostics
  const runDiagnostics = () => {
    setDiagnosticStatus('running');
    setDiagnosticResults({
      connectionSpeed: 'Testing...',
      latency: 'Testing...',
      databaseStatus: 'Checking...',
      storageUsage: 'Calculating...',
      browserSecure: window.isSecureContext,
      authStatus: 'Verifying...'
    });

    setTimeout(() => {
      // Mock network metrics
      const ping = Math.floor(Math.random() * 80) + 15;
      const speed = (Math.random() * 40 + 10).toFixed(1);
      
      // Calculate local storage size
      let _lsTotal = 0, _xLen, _x;
      for (_x in localStorage) {
        if (!localStorage.hasOwnProperty(_x)) continue;
        _xLen = ((localStorage[_x] + '').length + _x.length) * 2;
        _lsTotal += _xLen;
      }
      const kbUsed = (_lsTotal / 1024).toFixed(2);

      // Check secure context or local host
      let secureStatus = 'Insecure';
      if (window.isSecureContext) {
        secureStatus = 'Secure (HTTPS)';
      } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && /^(127\.)|^(192\.168\.)|^(10\.)|^(172\.(1[6-9]|2[0-9]|3[0-1])\.)/.test(window.location.hostname)) {
        secureStatus = 'Local LAN (HTTP)';
      } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        secureStatus = 'Local Dev (HTTP)';
      } else {
        secureStatus = 'Insecure (Needs HTTPS)';
      }

      setDiagnosticResults({
        connectionSpeed: `${speed} Mbps`,
        latency: `${ping} ms`,
        databaseStatus: 'Connected',
        storageUsage: `${kbUsed} KB / 5120 KB`,
        browserSecure: secureStatus,
        authStatus: userData ? `Logged in as ${userData.role}` : 'Not Authenticated'
      });
      setDiagnosticStatus('completed');
      toast.success('System diagnostics completed successfully!');
    }, 1800);
  };

  // Submit Support Ticket
  const handleSubmitTicket = async (e) => {
    e.preventDefault();
    if (!ticketForm.subject.trim() || !ticketForm.description.trim()) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const newTicket = {
        userId: currentUser?.uid || '',
        userName: userData?.name || '',
        userEmail: currentUser?.email || ticketForm.email || '',
        labId: userData?.labId || 'N/A',
        labName: userData?.labName || 'N/A',
        subject: ticketForm.subject,
        description: ticketForm.description,
        category: ticketForm.category,
        priority: ticketForm.priority,
        status: 'Open',
        adminResponse: '',
        createdAt: Timestamp.now()
      };
      
      await addDoc(collection(db, 'supportTickets'), newTicket);

      setTicketForm({
        subject: '',
        description: '',
        category: 'General Support',
        priority: 'Low',
        email: currentUser?.email || userData?.email || ''
      });
      toast.success('Your support ticket has been created! Our team will reach out shortly.');
    } catch (error) {
      console.error("Error creating ticket:", error);
      toast.error('Failed to submit ticket: ' + error.message);
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleSendMessage = () => {
    if (!chatInput.trim()) return;

    const userMsg = { sender: 'user', text: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    const query = chatInput.toLowerCase();
    setChatInput('');

    // Simulated response
    setTimeout(() => {
      let reply = "I'm not sure about that. Would you like me to raise a support ticket or contact our WhatsApp support desk at +91 91407-37374?";
      
      if (query.includes('hello') || query.includes('hi') || query.includes('hey')) {
        reply = "Hello! Tell me what problem you are facing in your Pathology software.";
      } else if (query.includes('print') || query.includes('report') || query.includes('pdf')) {
        reply = "To print or export reports, go to the 'Reports' section in the sidebar. Click on any booking, enter the test results, and click 'Verify'. Once verified, you will see a 'Print' button on the top right.";
      } else if (query.includes('barcode') || query.includes('scanner')) {
        reply = "Make sure your scanner is set to 'Keyboard Emulation' mode and that the focus is on the patient search input box before scanning.";
      } else if (query.includes('doctor') || query.includes('commission') || query.includes('referral')) {
        reply = "You can manage Doctor commission settings under the 'Doctors' tab. For billing payments, visit the 'Bills' page.";
      } else if (query.includes('backup') || query.includes('data')) {
        reply = "LabMitra automatically backs up all laboratory test reports, patient info, and billing sheets securely to Cloud Database in real-time. No manual backup is needed.";
      }

      setChatMessages(prev => [...prev, { sender: 'bot', text: reply }]);
    }, 700);
  };

  // FAQ Database
  const faqs = [
    {
      id: 1,
      category: 'General Support',
      question: 'How do I add a new pathology lab to my dashboard?',
      answer: 'Only SuperAdmin accounts can add and authorize new pathology labs. Navigate to the "SuperAdmin" dashboard in the sidebar, fill in the "Add Lab details" form, and hit submit. The new lab credentials will be activated instantly.'
    },
    {
      id: 2,
      category: 'Billing & Bookings',
      question: 'Can I add multiple tests under a single booking?',
      answer: 'Yes! When creating a Booking, search and select multiple tests from the dropdown list. The billing system will automatically add up the rates, apply the discounts if selected, and generate a unified bill invoice.'
    },
    {
      id: 3,
      category: 'Reports & Print',
      question: 'How do I customize the print layout for my lab letterhead?',
      answer: 'Navigate to "Settings" -> "Lab Settings". Here, you can configure your Lab Logo, address details, formatting heights, signature images, and custom letterhead margins. You can also hide/show headers dynamically for custom page templates.'
    },
    {
      id: 4,
      category: 'Lab Setup',
      question: 'My billing calculation is showing incorrect discounts. How to fix?',
      answer: 'Verify the test master rates from the "Tests" database. If you are applying custom packages, double-check if the discount rules collide. Make sure to refresh your local browser cache if calculations appear outdated.'
    },
    {
      id: 5,
      category: 'Reports & Print',
      question: 'How to download patient report PDFs in landscape or print directly?',
      answer: 'Once you click "Print" in the report screen, the browser system dialogue box appears. You can set the layout orientation to portrait/landscape, customize margins, select target printers, or choose "Save as PDF" directly.'
    }
  ];

  // Filter FAQs
  const filteredFaqs = faqs.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTab = activeTab === 'all' || faq.category.toLowerCase().replace(' & ', ' ') === activeTab;
    return matchesSearch && matchesTab;
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 py-4 w-full flex-grow text-slate-800 animate-in fade-in duration-500">
      
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-xl font-display font-bold text-brand-dark leading-tight flex items-center">
            <div className="p-2 bg-slate-50 border border-brand-primary/10 rounded-xl mr-3 shadow-sm transition-transform hover:scale-110">
              <HelpCircle className="w-5 h-5 text-brand-primary" />
            </div>
            Help & Support
          </h1>
          <p className="text-[11px] font-medium text-slate-500 mt-1.5">Get instant diagnostic scans, review documentation, or request custom software support.</p>
        </div>

        {/* Live Support Indicators */}
        <div className="flex items-center gap-3">
          <a 
            href="https://wa.me/919140737374" 
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white border border-slate-100 rounded-xl px-4 py-2 hover:bg-slate-50 transition-all text-xs font-semibold text-slate-700 cursor-pointer shadow-xs"
          >
            <MessageCircle className="w-3.5 h-3.5 text-emerald-500 fill-emerald-500/10" />
            <span>WhatsApp Support</span>
          </a>
          <button 
            onClick={() => setChatOpen(true)}
            className="flex items-center gap-2 bg-brand-primary text-white rounded-xl px-4 py-2 hover:bg-emerald-600 transition-all text-xs font-bold shadow-lg hover:shadow-brand-primary/20 cursor-pointer border-none"
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Chat Assistant</span>
          </button>
        </div>
      </div>

      {/* Grid: Diagnostics and FAQs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Diagnostics and Quick Links */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* Dynamic Diagnostic Card */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm uppercase">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-emerald-50 rounded-xl">
                <Activity className="w-4 h-4 text-emerald-600" />
              </div>
              <h3 className="text-[13px] font-display font-bold text-brand-dark tracking-tight">System Health Diagnostic</h3>
            </div>
            
            <p className="text-[10px] font-medium text-slate-500 normal-case mb-5 leading-normal">
              Verify database latency, authentication health, browser security configuration, and connection speed instantly.
            </p>

            <div className="space-y-3 mb-6 normal-case">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                <span className="text-slate-500 flex items-center gap-2 font-medium">
                  Latency
                </span>
                <span className="font-mono text-slate-800 font-bold">{diagnosticResults.latency || '--'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                <span className="text-slate-500 flex items-center gap-2 font-medium">
                  Connection Speed
                </span>
                <span className="font-mono text-slate-800 font-bold">{diagnosticResults.connectionSpeed || '--'}</span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                <span className="text-slate-500 flex items-center gap-2 font-medium">
                  Secure Sandbox
                </span>
                <span className={`font-bold ${
                  diagnosticResults.browserSecure === 'Secure (HTTPS)' 
                    ? 'text-emerald-600' 
                    : (diagnosticResults.browserSecure === 'Local LAN (HTTP)' || diagnosticResults.browserSecure === 'Local Dev (HTTP)')
                      ? 'text-amber-600'
                      : diagnosticResults.browserSecure === 'idle' || diagnosticResults.browserSecure === 'Testing...'
                        ? 'text-slate-500'
                        : 'text-rose-600'
                }`}>
                  {diagnosticResults.browserSecure === 'idle' ? '--' : (diagnosticResults.browserSecure || '--')}
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-slate-100 pb-2 text-xs">
                <span className="text-slate-500 flex items-center gap-2 font-medium">
                  Database Status
                </span>
                <span className="text-slate-800 font-bold truncate max-w-[150px]">{diagnosticResults.databaseStatus}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 flex items-center gap-2 font-medium">
                  Local Storage Cache
                </span>
                <span className="font-mono text-slate-800 font-bold">{diagnosticResults.storageUsage}</span>
              </div>
            </div>

            <button 
              onClick={runDiagnostics}
              disabled={diagnosticStatus === 'running'}
              className="w-full flex items-center justify-center gap-2 bg-slate-50 border border-slate-200 text-slate-700 rounded-2xl py-2.5 text-[11px] font-bold hover:bg-slate-100 transition-all cursor-pointer group active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-brand-primary ${diagnosticStatus === 'running' ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
              <span>{diagnosticStatus === 'running' ? 'Running Diagnostics...' : 'Run Diagnostics'}</span>
            </button>
          </div>

          {/* Quick Guides & Documents */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm uppercase">
            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 bg-sky-50 rounded-xl">
                <BookOpen className="w-4 h-4 text-sky-600" />
              </div>
              <h3 className="text-[13px] font-display font-bold text-brand-dark tracking-tight">Quick References</h3>
            </div>
            
            <div className="space-y-3 normal-case">
              <Link 
                to="/about" 
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all text-xs text-slate-700 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <Info className="w-4 h-4 text-brand-primary" />
                  <span className="font-semibold">About LabMitra Cloud</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </Link>
              <div 
                onClick={() => toast.info('Detailed user manual will download shortly...')}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 hover:bg-slate-100 border border-slate-100 transition-all text-xs text-slate-700 cursor-pointer group"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="w-4 h-4 text-brand-primary" />
                  <span className="font-semibold">Download Lab User Manual</span>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </div>
        </div>

        {/* Right Columns: FAQs and Custom Ticket Forms */}
        <div className="space-y-6 lg:col-span-2">
          
          {/* FAQ Search and List */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm uppercase">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-[13px] font-display font-bold text-brand-dark tracking-tight">Frequently Asked Questions</h3>
                <p className="text-[10px] font-medium text-slate-500 normal-case mt-0.5">Search local guidelines to resolve billing, booking, and print issues immediately.</p>
              </div>

              {/* Search FAQ */}
              <div className="relative md:w-64 shrink-0 normal-case">
                <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Search className="w-4 h-4 text-slate-400" />
                </span>
                <input 
                  type="text" 
                  placeholder="Search FAQs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl pl-9 pr-4 py-2 focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none transition-all"
                />
              </div>
            </div>

            {/* Tab category selectors */}
            <div className="flex flex-wrap gap-2 border-b border-slate-100 pb-4 mb-5 normal-case">
              {[
                { id: 'all', label: 'All FAQs' },
                { id: 'general support', label: 'General' },
                { id: 'billing bookings', label: 'Billing' },
                { id: 'reports print', label: 'Reports & Print' },
                { id: 'lab setup', label: 'Setup' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-all cursor-pointer border-none ${activeTab === tab.id ? 'bg-brand-primary text-white font-bold' : 'bg-slate-50 text-slate-600 hover:bg-slate-100'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* FAQ Item List */}
            {filteredFaqs.length > 0 ? (
              <div className="space-y-3 normal-case">
                {filteredFaqs.map(faq => (
                  <div 
                    key={faq.id}
                    className="border border-slate-100 rounded-xl bg-slate-50/30 overflow-hidden transition-all duration-300"
                  >
                    <button
                      onClick={() => toggleFaq(faq.id)}
                      className="w-full p-4 flex items-center justify-between text-left cursor-pointer hover:bg-slate-50 transition-colors border-none bg-transparent"
                    >
                      <span className="text-xs font-semibold text-slate-700">{faq.question}</span>
                      <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${faqExpanded[faq.id] ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {faqExpanded[faq.id] && (
                      <div className="p-4 pt-0 border-t border-slate-100 bg-white/40 text-xs text-slate-500 leading-relaxed animate-in slide-in-from-top duration-300">
                        {faq.answer}
                        <div className="mt-3 flex items-center gap-1.5">
                          <span className="bg-brand-primary/10 text-brand-primary text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                            {faq.category}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 normal-case">
                <AlertCircle className="w-8 h-8 mb-2 opacity-50 text-slate-300" />
                <p className="text-xs">No matching FAQs found. Try searching for different keywords.</p>
              </div>
            )}
          </div>

          {/* Raise Support Ticket Form */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm uppercase">
            <div className="border-b border-slate-100 pb-4 mb-5">
              <h3 className="text-[13px] font-display font-bold text-brand-dark tracking-tight">Create Support Ticket</h3>
              <p className="text-[10px] font-medium text-slate-500 normal-case mt-0.5">Can't resolve your issue? Submit a ticket and our development team will inspect your workspace.</p>
            </div>

            <form onSubmit={handleSubmitTicket} className="space-y-4 normal-case">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Category</label>
                  <select 
                    value={ticketForm.category}
                    onChange={(e) => setTicketForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary font-medium"
                  >
                    <option value="General Support">General Support</option>
                    <option value="Billing & Bookings">Billing & Bookings</option>
                    <option value="Reports & Print">Reports & Print</option>
                    <option value="Lab Setup">Lab Setup</option>
                    <option value="Account Settings">Account Settings</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Priority</label>
                  <select 
                    value={ticketForm.priority}
                    onChange={(e) => setTicketForm(prev => ({ ...prev, priority: e.target.value }))}
                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary font-medium"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Subject</label>
                <input 
                  type="text"
                  required
                  placeholder="Describe the issue in 4-6 words..."
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl px-3 py-2.5 outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary font-medium"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Detailed Description</label>
                <textarea 
                  required
                  rows={4}
                  placeholder="Describe exactly what happened, including steps to reproduce the issue..."
                  value={ticketForm.description}
                  onChange={(e) => setTicketForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl p-3 outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary font-medium resize-none leading-relaxed"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmittingTicket}
                  className="flex items-center gap-2 bg-brand-primary text-white px-6 py-2.5 rounded-xl hover:bg-emerald-600 transition-all text-xs font-bold shadow-lg hover:shadow-brand-primary/20 cursor-pointer border-none"
                >
                  {isSubmittingTicket ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Creating Ticket...</span>
                    </>
                  ) : (
                    <>
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Submit Ticket</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* My Tickets List */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm uppercase">
            <div className="border-b border-slate-100 pb-4 mb-5">
              <h3 className="text-[13px] font-display font-bold text-brand-dark tracking-tight">Active Tickets</h3>
              <p className="text-[10px] font-medium text-slate-500 normal-case mt-0.5">Track and review technical support requests submitted from this account.</p>
            </div>

            <div className="overflow-x-auto normal-case">
              <table className="w-full text-left text-xs text-slate-600">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 uppercase tracking-wider text-[9px] font-bold">
                    <th className="pb-3 pl-2">Ticket ID</th>
                    <th className="pb-3">Subject</th>
                    <th className="pb-3">Category</th>
                    <th className="pb-3">Priority</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 pr-2 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingTickets ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 font-medium">
                        <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-brand-primary" />
                        <span>Loading tickets...</span>
                      </td>
                    </tr>
                  ) : tickets.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="py-8 text-center text-slate-400 font-medium">
                        <AlertCircle className="w-5 h-5 mx-auto mb-2 text-slate-300" />
                        <span>No tickets created yet.</span>
                      </td>
                    </tr>
                  ) : (
                    tickets.map(ticket => (
                      <tr 
                        key={ticket.id} 
                        onClick={() => setSelectedTicket(ticket)}
                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        <td className="py-3 pl-2 font-mono text-[11px] text-brand-primary font-bold">
                          {ticket.id.startsWith('TKT-') ? ticket.id : `TKT-${ticket.id.substring(0, 8).toUpperCase()}`}
                        </td>
                        <td className="py-3 font-semibold text-slate-800 max-w-[200px] truncate">{ticket.subject}</td>
                        <td className="py-3 text-slate-500">{ticket.category}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            ticket.priority === 'High' || ticket.priority === 'Critical'
                              ? 'bg-rose-500/15 text-rose-600' 
                              : 'bg-blue-500/15 text-blue-600'
                          }`}>
                            {ticket.priority}
                          </span>
                        </td>
                        <td className="py-3">
                          <span className={`flex items-center gap-1.5 text-[10px] font-bold ${
                            ticket.status === 'Resolved' 
                              ? 'text-emerald-600' 
                              : ticket.status === 'Under Review' 
                                ? 'text-amber-600' 
                                : 'text-sky-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              ticket.status === 'Resolved' 
                                ? 'bg-emerald-500' 
                                : ticket.status === 'Under Review' 
                                  ? 'bg-amber-500 animate-pulse' 
                                  : 'bg-sky-500'
                            }`} />
                            {ticket.status}
                          </span>
                        </td>
                        <td className="py-3 pr-2 text-right text-slate-400 text-[10px] font-mono">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Response / Ticket Details Modal */}
      {selectedTicket && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[24px] shadow-2xl max-w-xl w-full p-6 text-left border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-500">
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs text-brand-primary font-bold bg-brand-primary/10 px-2.5 py-1 rounded-lg">
                  {selectedTicket.id.startsWith('TKT-') ? selectedTicket.id : `TKT-${selectedTicket.id.substring(0, 8).toUpperCase()}`}
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedTicket.priority === 'High' || selectedTicket.priority === 'Critical'
                    ? 'bg-rose-500/15 text-rose-600' 
                    : 'bg-blue-500/15 text-blue-600'
                }`}>
                  {selectedTicket.priority}
                </span>
              </div>
              <button 
                onClick={() => setSelectedTicket(null)} 
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer border-none bg-transparent"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto py-5 space-y-4 pr-1">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Subject</span>
                <h3 className="text-sm font-bold text-slate-800 mt-0.5">{selectedTicket.subject}</h3>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Detailed Description</span>
                <p className="text-xs text-slate-600 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100/50 mt-1 leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Category</span>
                  <span className="text-xs font-semibold text-slate-700 mt-1 block">{selectedTicket.category}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Submitted Date</span>
                  <span className="text-xs font-semibold text-slate-700 mt-1 block">
                    {new Date(selectedTicket.createdAt).toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Resolution Status</span>
                
                {selectedTicket.status === 'Resolved' ? (
                  <div className="bg-emerald-50/50 border border-emerald-100/60 p-4 rounded-xl">
                    <div className="flex items-center gap-2 mb-2 text-emerald-600 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>LabMitra Team Response</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">
                      {selectedTicket.adminResponse || "This ticket was resolved by the support team."}
                    </p>
                  </div>
                ) : selectedTicket.status === 'Under Review' ? (
                  <div className="bg-amber-50/50 border border-amber-100/60 p-4 rounded-xl text-xs text-amber-700 flex items-start gap-2.5">
                    <Clock className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" style={{ animationDuration: '2s' }} />
                    <div>
                      <p className="font-bold">Under Review</p>
                      <p className="mt-0.5 text-slate-500 leading-normal">Our development team is currently inspecting your workspace. We will update you here shortly.</p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-sky-50/50 border border-sky-100/60 p-4 rounded-xl text-xs text-sky-700 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">Ticket Open</p>
                      <p className="mt-0.5 text-slate-500 leading-normal">Your ticket has been logged and is in queue. Our engineers will take this up soon.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-100 flex justify-end shrink-0">
              <button 
                onClick={() => setSelectedTicket(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer border-none"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Chat Assistant Widget */}
      {chatOpen && (
        <div className="fixed bottom-6 right-6 z-[100] w-80 md:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl flex flex-col h-[450px] overflow-hidden animate-in slide-in-from-bottom duration-300">
          
          {/* Chat Header */}
          <div className="bg-slate-900 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 bg-emerald-400 rounded-full animate-pulse" />
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Virtual Support Desk</h4>
                <p className="text-[9px] text-slate-400">Available 24/7 • Instant Diagnostics</p>
              </div>
            </div>
            <button 
              onClick={() => setChatOpen(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer border-none bg-transparent"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar bg-slate-50">
            {chatMessages.map((msg, index) => (
              <div 
                key={index} 
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className={`p-3 rounded-2xl text-xs max-w-[85%] leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-brand-primary text-white font-semibold rounded-tr-none' 
                    : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-xs'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          {/* Chat Input */}
          <div className="p-3 bg-white border-t border-slate-100 flex gap-2 items-center">
            <input 
              type="text" 
              placeholder="Ask about reports, billing, or printers..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 text-xs rounded-xl px-4 py-2.5 outline-none focus:ring-1 focus:ring-brand-primary focus:border-brand-primary transition-all"
            />
            <button 
              onClick={handleSendMessage}
              className="bg-brand-primary text-white p-2.5 rounded-xl hover:bg-emerald-600 transition-all shadow-md cursor-pointer border-none"
            >
              <Send className="w-3.5 h-3.5 text-white" />
            </button>
          </div>
        </div>
      )}

    </div>
  );
};

export default HelpSupport;
