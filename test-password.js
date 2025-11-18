const bcrypt = require('bcrypt');

const testPassword = 'Password123!';
const hash = '$2b$10$rKZYpZxOGc7vCH3UIxjfme1JEcLxLxHN/xvC3z8yDNWjpHxNxKHx2';

bcrypt.compare(testPassword, hash).then(result => {
  console.log('Password "Password123!" matches hash:', result);
  
  if (!result) {
    // Generate a new hash
    bcrypt.hash(testPassword, 10).then(newHash => {
      console.log('New hash for "Password123!":', newHash);
    });
  }
});
