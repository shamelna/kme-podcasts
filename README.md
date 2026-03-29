# KME Podcasts Collection

A dynamic podcast collection platform focused on continuous improvement and Lean methodology content.

## 🔐 Security Setup (IMPORTANT)

This application uses Firebase Authentication for admin access. Follow these steps for secure deployment:

### 1. Environment Configuration
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your Firebase credentials
nano .env
```

### 2. Firebase Admin Account
- **Admin Email**: `info@kaizenmadeeasy.com`
- **Password**: Set via Firebase Console (not hardcoded)
- **Authentication**: Firebase Auth (not localStorage)

### 3. Firebase Security Rules
- **Public Read**: Episodes and podcasts are publicly readable
- **Admin Write**: Write/delete operations require admin authentication
- **User Data**: Users can only access their own data

### 4. Deployment Security Checklist
- [ ] Regenerate Firebase API key
- [ ] Set FIREBASE_API_KEY in .env
- [ ] Deploy secure Firestore rules
- [ ] Test admin authentication
- [ ] Verify write restrictions

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- Firebase account with admin setup
- Environment variables configured

### Development
```bash
# Install dependencies
npm install

# Start development server
python -m http.server 8080

# Access admin dashboard
http://localhost:8080/admin.html
```

### Production Deployment
```bash
# Deploy Cloudflare Worker (CORS proxy)
cd cloudflare-worker
npx wrangler deploy

# Deploy to your hosting platform
# Ensure .env is available in production environment
```

## 📁 Project Structure

```
kme-podcasts/
├── index.html              # Main user-facing application
├── admin.html              # Administrative dashboard
├── js/
│   ├── app.js              # Main application logic
│   ├── admin-dashboard.js   # Admin functionality
│   ├── firebase-config.js    # Firebase configuration
│   └── service-worker.js     # Background sync
├── css/
│   └── styles.css           # Application styles
├── cloudflare-worker/        # CORS proxy for RSS feeds
├── .env.example            # Environment variables template
└── firestore.rules          # Security rules
```

## 🔧 Features

### User Application
- **Podcast Discovery**: Browse and search podcast collection
- **Episode Management**: Play, favorite, and queue episodes
- **Responsive Design**: Mobile-friendly interface
- **Audio Player**: Built-in player with progress tracking
- **Search & Filter**: Find content quickly

### Admin Dashboard
- **Firebase Auth**: Secure admin authentication
- **Podcast Management**: Add, edit, remove podcasts
- **Bulk Operations**: Sync multiple podcasts simultaneously
- **Image Extraction**: Comprehensive RSS feed parsing
- **Analytics Dashboard**: Usage statistics and metrics
- **Database Inspection**: View and manage data

### Technical Features
- **CORS Proxy**: Cloudflare Worker for RSS feed access
- **Service Worker**: Background sync and caching
- **Progressive Enhancement**: Offline capability
- **Image Optimization**: Multiple RSS format support

## 🔒 Security Features

- **Firebase Authentication**: Server-side admin validation
- **Secure Firestore Rules**: Role-based access control
- **Environment Variables**: Sensitive data out of source control
- **Input Validation**: XSS prevention and sanitization
- **HTTPS Only**: Secure communication protocols

## 📊 Analytics & Monitoring

- **Visitor Tracking**: Session-based analytics
- **Episode Analytics**: Play counts and engagement
- **Performance Metrics**: Load times and error rates
- **Admin Dashboard**: Real-time statistics

## 🛠️ Development

### Technology Stack
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Backend**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Proxy**: Cloudflare Workers
- **Caching**: Service Worker API

### Code Quality
- **Modular Architecture**: Clean separation of concerns
- **Error Handling**: Comprehensive try-catch patterns
- **Performance**: Lazy loading and optimization
- **Documentation**: Inline comments and analysis

## 📚 Documentation

- [Comprehensive Architecture Analysis](./APP_COMPREHENSIVE_ANALYSIS.md)
- [Cloudflare Worker Setup](./CLOUDFLARE_SETUP.md)
- [Security Guidelines](./SECURITY.md) (coming soon)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Follow security guidelines
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is part of the Kaizen Made Easy initiative.

## 🔗 Links

- **Main Website**: [kaizenmadeeasy.com](https://kaizenmadeeasy.com)
- **YouTube Channel**: [Kaizen Made Easy](https://www.youtube.com/@kaizenmadeeasy)
- **LinkedIn**: [Kaizen Made Easy](https://www.linkedin.com/company/kaizen-made-easy)
- **Store**: [Kaizen Merch](https://kaizenmadeeasy.com/merch)

---

**⚠️ Security Notice**: Never commit sensitive credentials to version control. Always use environment variables for production deployments.