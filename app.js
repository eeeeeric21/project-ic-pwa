// Project IC PWA - Main Application
class AesculHelper {
    constructor() {
        this.apiBaseUrl = 'http://meralion.org:8010/v1';
        this.apiKey = 'Liu-NHhjTaune12IV090NU8qTNSsaAJwBjx5';
        this.model = 'MERaLiON/MERaLiON-3-10B';
        
        // Supabase config
        this.supabaseUrl = 'https://xhonxrvogiamqhpfouoh.supabase.co';
        this.supabaseKey = 'sb_publishable_1XmCjaQQhz0zSsIpq3k6IQ_v9u9EYe7';
        this.supabase = supabase.createClient(this.supabaseUrl, this.supabaseKey);
        
        this.currentPatient = null;
        this.conversationHistory = [];
        this.riskScore = 0;
        this.signals = [];
        this.isListening = false;
        this.sessionId = null;
        
        this.init();
    }
    
    init() {
        this.bindEvents();
        this.initSpeechRecognition();
        
        // Check if service worker is supported
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {});
        }
    }
    
    bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.role));
        });
        
        // Login buttons
        document.getElementById('login-btn').addEventListener('click', () => this.patientLogin());
        document.getElementById('caregiver-login-btn').addEventListener('click', () => this.caregiverLogin());
        
        // Back buttons
        document.getElementById('back-btn').addEventListener('click', () => this.showScreen('login'));
        document.getElementById('dashboard-back-btn').addEventListener('click', () => this.showScreen('login'));
        
        // Voice button
        document.getElementById('voice-btn').addEventListener('click', () => this.toggleVoice());
        
        // Quick action buttons
        document.querySelectorAll('.quick-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.sendQuickMessage(e.target.dataset.msg));
        });
        
        // Summary modal
        document.getElementById('summary-close').addEventListener('click', () => this.closeSummary());
    }
    
    switchTab(role) {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.role === role);
        });
        
        document.getElementById('patient-login').classList.toggle('hidden', role !== 'patient');
        document.getElementById('caregiver-login').classList.toggle('hidden', role !== 'caregiver');
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.add('hidden');
        });
        document.getElementById(`${screenId}-screen`).classList.remove('hidden');
    }
    
    async patientLogin() {
        const name = document.getElementById('patient-id').value.trim();
        if (!name) {
            alert('Please enter your name');
            return;
        }
        
        this.currentPatient = {
            id: 'pwa-' + Date.now(),
            name: name,
            preferred_name: name
        };
        
        document.getElementById('patient-name').textContent = name;
        this.showScreen('checkin');
        this.speak(`Hello ${name}! I'm here to check in on you. How are you feeling today?`);
        
        // Create check-in session in database
        await this.createCheckinSession();
    }
    
    caregiverLogin() {
        const id = document.getElementById('caregiver-id').value.trim();
        const pin = document.getElementById('caregiver-pin').value.trim();
        
        // Simple demo auth
        if (id && pin === '1234') {
            this.loadDashboard();
            this.showScreen('dashboard');
        } else {
            alert('Invalid credentials. Use any ID with PIN: 1234');
        }
    }
    
    // Speech Recognition
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-SG';
            
            this.recognition.onresult = (event) => {
                const transcript = Array.from(event.results)
                    .map(result => result[0].transcript)
                    .join('');
                document.getElementById('transcript').textContent = transcript;
                
                if (event.results[0].isFinal) {
                    this.processUserMessage(transcript);
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                this.stopListening();
            };
            
            this.recognition.onend = () => {
                this.stopListening();
            };
        } else {
            console.warn('Speech recognition not supported');
        }
    }
    
    toggleVoice() {
        if (this.isListening) {
            this.stopListening();
        } else {
            this.startListening();
        }
    }
    
    startListening() {
        if (!this.recognition) {
            alert('Voice input not supported in this browser. Try Chrome.');
            return;
        }
        
        this.isListening = true;
        const voiceBtn = document.getElementById('voice-btn');
        voiceBtn.classList.add('listening');
        document.getElementById('status-text').textContent = 'Listening...';
        document.getElementById('transcript').textContent = '';
        
        this.recognition.start();
    }
    
    stopListening() {
        this.isListening = false;
        const voiceBtn = document.getElementById('voice-btn');
        voiceBtn.classList.remove('listening');
        document.getElementById('status-text').textContent = 'Tap to speak';
    }
    
    // Text-to-Speech
    speak(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-SG';
            utterance.rate = 0.9;
            utterance.pitch = 1;
            speechSynthesis.speak(utterance);
        }
    }
    
    // Quick Messages
    sendQuickMessage(message) {
        document.getElementById('transcript').textContent = message;
        this.processUserMessage(message);
    }
    
    // Message Processing
    async processUserMessage(message) {
        if (!message.trim()) return;
        
        // Add user message to chat
        this.addMessageToChat('user', message);
        
        // Analyze for risk signals
        const analysis = this.analyzeMessage(message);
        this.riskScore += analysis.riskScore;
        if (analysis.signals.length > 0) {
            this.signals.push(...analysis.signals);
        }
        this.updateRiskIndicator();
        
        // Store in history
        this.conversationHistory.push({ role: 'user', content: message });
        
        // Save message to database
        await this.saveMessage('user', message, analysis);
        
        // Show typing indicator
        this.showTypingIndicator();
        
        // Get AI response
        try {
            const response = await this.getAIResponse(message);
            this.hideTypingIndicator();
            this.addMessageToChat('ai', response);
            this.speak(response);
            this.conversationHistory.push({ role: 'assistant', content: response });
            
            // Save AI response to database
            await this.saveMessage('assistant', response, { signals: [], riskScore: 0 });
            
            // Update check-in with new risk score
            await this.updateCheckinRisk();
            
            // Check if alert needed
            if (this.riskScore >= 30) {
                await this.triggerAlert();
            }
        } catch (error) {
            console.error('AI response error:', error);
            this.hideTypingIndicator();
            const fallback = this.getFallbackResponse(analysis);
            this.addMessageToChat('ai', fallback);
            this.speak(fallback);
            
            // Save fallback response
            await this.saveMessage('assistant', fallback, { signals: [], riskScore: 0 });
        }
    }
    
    analyzeMessage(message) {
        const lowerMsg = message.toLowerCase();
        const result = { riskScore: 0, signals: [] };
        
        // Pain signals
        const painKeywords = ['pain', 'hurt', 'ache', 'sore', 'uncomfortable', 'sakit'];
        if (painKeywords.some(k => lowerMsg.includes(k))) {
            result.riskScore += 5;
            result.signals.push('pain');
        }
        
        // Distress signals
        const distressKeywords = ['sad', 'lonely', 'worried', 'scared', 'anxious', 'depressed', 'alone'];
        if (distressKeywords.some(k => lowerMsg.includes(k))) {
            result.riskScore += 4;
            result.signals.push('distress');
        }
        
        // Cognitive signals
        const cognitiveKeywords = ['forget', 'confused', 'lost', "can't remember", 'memory'];
        if (cognitiveKeywords.some(k => lowerMsg.includes(k))) {
            result.riskScore += 3;
            result.signals.push('cognitive');
        }
        
        // Red flags (immediate escalation)
        const redFlags = ["can't breathe", 'chest pain', 'fell', 'fall', 'unconscious', 'emergency'];
        if (redFlags.some(k => lowerMsg.includes(k))) {
            result.riskScore += 50;
            result.signals.push('red_flag');
        }
        
        return result;
    }
    
    async getAIResponse(message) {
        const systemPrompt = `You are a caring AI health companion for elderly patients in Singapore. 
You speak in a warm, friendly Singlish style naturally (use "lah", "hor", "ah" sparingly and naturally).
Keep responses short (1-2 sentences), empathetic, and ask follow-up questions about their health.
Current patient: ${this.currentPatient.name}
Current risk score: ${this.riskScore}
Detected signals: ${this.signals.join(', ') || 'none'}`;

        const messages = [
            { role: 'system', content: systemPrompt },
            ...this.conversationHistory.slice(-6), // Last 3 exchanges
            { role: 'user', content: message }
        ];
        
        const response = await fetch(`${this.apiBaseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.apiKey}`
            },
            body: JSON.stringify({
                model: this.model,
                messages: messages,
                temperature: 0.7,
                max_tokens: 100
            })
        });
        
        if (!response.ok) {
            throw new Error('API request failed');
        }
        
        const data = await response.json();
        return data.choices[0].message.content.trim();
    }
    
    getFallbackResponse(analysis) {
        const responses = {
            pain: [
                "Aiyo, sorry to hear got pain ah. Where exactly does it hurt?",
                "Wah, painful sia. Is it the usual pain or worse today?",
                "Pain again? Tell uncle/aunty where not comfortable, I listen.",
                "Sorry to hear that. On a scale of 1-10, how painful is it?",
                "Aiyo, must take care okay. Have you taken any medicine for the pain?"
            ],
            distress: [
                "I can feel something's troubling you. Want to share more? I'm here.",
                "Aiyah, sounds tough. Don't keep it inside, tell me more okay?",
                "I understand. It's okay to feel this way sometimes. You're not alone.",
                "Take your time. I'm here to listen whenever you're ready.",
                "That sounds hard. Do you want to talk about what's bothering you?"
            ],
            cognitive: [
                "Nevermind lah, take your time. Sometimes we all forget things.",
                "No rush ah. What were you trying to remember?",
                "It's okay one, happens to everyone. Don't worry too much hor.",
                "Take a breath. Maybe it will come back to you later.",
                "No problem, we can figure it out together."
            ],
            red_flag: [
                "This sounds serious! Please stay calm. I'm alerting your caregiver now.",
                "Oh no! Please sit down and rest. Help is on the way."
            ],
            default: [
                "I see. Tell me more about that lah.",
                "How are you feeling overall today?",
                "Good to know! Anything else you want to share?",
                "I understand. What else is on your mind?",
                "Okay, tell me more about your day so far.",
                "That's interesting! How does that make you feel?",
                "I hear you. Is there anything else bothering you today?"
            ]
        };
        
        const category = analysis.signals[0] || 'default';
        const options = responses[category] || responses.default;
        return options[Math.floor(Math.random() * options.length)];
    }
    
    addMessageToChat(type, content) {
        const container = document.getElementById('chat-container');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        
        const time = new Date().toLocaleTimeString('en-SG', { hour: '2-digit', minute: '2-digit' });
        
        messageDiv.innerHTML = `
            <div class="bubble">${content}</div>
            <div class="message-time">${time}</div>
        `;
        
        // Remove welcome message if exists
        const welcome = container.querySelector('.welcome-message');
        if (welcome) welcome.remove();
        
        container.appendChild(messageDiv);
        container.scrollTop = container.scrollHeight;
        
        // Scroll page to show new message
        setTimeout(() => {
            messageDiv.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }, 100);
    }
    
    showTypingIndicator() {
        const container = document.getElementById('chat-container');
        const typingDiv = document.createElement('div');
        typingDiv.className = 'message message-ai typing-message';
        typingDiv.innerHTML = `
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        container.appendChild(typingDiv);
        container.scrollTop = container.scrollHeight;
    }
    
    hideTypingIndicator() {
        const typing = document.querySelector('.typing-message');
        if (typing) typing.remove();
    }
    
    updateRiskIndicator() {
        const indicator = document.getElementById('risk-indicator');
        let level, emoji;
        
        if (this.riskScore >= 50) {
            level = 'red'; emoji = '🔴';
        } else if (this.riskScore >= 30) {
            level = 'orange'; emoji = '🟠';
        } else if (this.riskScore >= 15) {
            level = 'yellow'; emoji = '🟡';
        } else {
            level = 'green'; emoji = '🟢';
        }
        
        indicator.className = `risk-badge ${level}`;
        indicator.textContent = emoji;
        
        // Trigger alert if high risk
        if (this.riskScore >= 30 && this.riskScore < 35) {
            this.showAlertNotification();
        }
    }
    
    showAlertNotification() {
        this.addMessageToChat('ai', "🙏 I'm a bit concerned. I'll make sure someone checks in on you.");
    }
    
    // ========== Database Methods ==========
    
    async createCheckinSession() {
        try {
            // First, create or get patient
            let patientId = this.currentPatient.id;
            
            // Check if patient exists
            const { data: existingPatient } = await this.supabase
                .from('patients')
                .select('id')
                .eq('name', this.currentPatient.name)
                .single();
            
            if (existingPatient) {
                patientId = existingPatient.id;
            } else {
                // Create new patient
                const { data: newPatient, error } = await this.supabase
                    .from('patients')
                    .insert({
                        name: this.currentPatient.name,
                        preferred_name: this.currentPatient.preferred_name
                    })
                    .select()
                    .single();
                
                if (!error && newPatient) {
                    patientId = newPatient.id;
                    this.currentPatient.id = patientId;
                }
            }
            
            // Create check-in session
            const { data: checkin, error } = await this.supabase
                .from('checkins')
                .insert({
                    patient_id: patientId,
                    session_type: 'ad-hoc',
                    risk_score: 0,
                    detected_categories: [],
                    risk_level: 'GREEN'
                })
                .select()
                .single();
            
            if (!error && checkin) {
                this.sessionId = checkin.id;
                console.log('Check-in session created:', this.sessionId);
            }
        } catch (error) {
            console.error('Error creating check-in session:', error);
        }
    }
    
    async saveMessage(role, content, analysis) {
        if (!this.sessionId) return;
        
        try {
            await this.supabase
                .from('messages')
                .insert({
                    checkin_id: this.sessionId,
                    patient_id: this.currentPatient.id,
                    role: role,
                    content: content,
                    detected_signals: {
                        categories: analysis.signals || [],
                        risk_score: analysis.riskScore || 0
                    }
                });
        } catch (error) {
            console.error('Error saving message:', error);
        }
    }
    
    async updateCheckinRisk() {
        if (!this.sessionId) return;
        
        try {
            const riskLevel = this.riskScore >= 50 ? 'RED' : 
                             this.riskScore >= 30 ? 'ORANGE' : 
                             this.riskScore >= 15 ? 'YELLOW' : 'GREEN';
            
            await this.supabase
                .from('checkins')
                .update({
                    risk_score: this.riskScore,
                    detected_categories: [...new Set(this.signals)],
                    risk_level: riskLevel
                })
                .eq('id', this.sessionId);
        } catch (error) {
            console.error('Error updating check-in:', error);
        }
    }
    
    async triggerAlert() {
        if (!this.sessionId || !this.currentPatient) return;
        
        try {
            const riskLevel = this.riskScore >= 50 ? 'RED' : 'ORANGE';
            
            // Create alert
            await this.supabase
                .from('alerts')
                .insert({
                    patient_id: this.currentPatient.id,
                    checkin_id: this.sessionId,
                    alert_level: riskLevel,
                    title: 'High Risk Detected',
                    message: `Risk score: ${this.riskScore}. Signals: ${[...new Set(this.signals)].join(', ')}`,
                    detected_issues: [...new Set(this.signals)]
                });
            
            console.log('Alert triggered:', riskLevel);
            
            // Show user notification
            this.addMessageToChat('ai', "🙏 I'm concerned about what you've shared. I'll make sure someone checks in on you.");
        } catch (error) {
            console.error('Error triggering alert:', error);
        }
    }
    
    // Dashboard
    loadDashboard() {
        // Demo data
        const patients = [
            { name: 'Uncle Tan', status: 'Last check-in: 2 hours ago', risk: '🟢' },
            { name: 'Auntie Mei', status: 'Last check-in: 5 hours ago', risk: '🟡' }
        ];
        
        const listContainer = document.getElementById('patient-list');
        listContainer.innerHTML = patients.map(p => `
            <div class="patient-card">
                <div class="patient-avatar">${p.name.charAt(0)}</div>
                <div class="patient-info">
                    <div class="patient-name">${p.name}</div>
                    <div class="patient-status">${p.status}</div>
                </div>
                <div class="patient-risk">${p.risk}</div>
            </div>
        `).join('');
    }
    
    closeSummary() {
        document.getElementById('summary-modal').classList.add('hidden');
        this.resetSession();
        this.showScreen('login');
    }
    
    resetSession() {
        this.conversationHistory = [];
        this.riskScore = 0;
        this.signals = [];
        this.currentPatient = null;
        
        // Clear chat
        const container = document.getElementById('chat-container');
        container.innerHTML = `
            <div class="welcome-message">
                <p>I'm here to check in on you. Tap the microphone and tell me how you're feeling today.</p>
            </div>
        `;
        
        // Reset risk indicator
        const indicator = document.getElementById('risk-indicator');
        indicator.className = 'risk-badge green';
        indicator.textContent = '🟢';
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AesculHelper();
});
