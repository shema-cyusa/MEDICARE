import React from 'react';

const AuthContext = React.createContext({
  isLoggedIn: false,
  userType: null,
  user: null,
  setUser: () => {},
  logout: async () => {},
});

export default AuthContext;
