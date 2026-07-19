function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    next();
  } else {
    // If API request, return 401; else redirect
    if (req.path.startsWith('/api/')) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
    } else {
      res.redirect('/admin/login');
    }
  }
}

module.exports = { requireAdmin };
