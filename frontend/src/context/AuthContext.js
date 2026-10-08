import React, { Component, createContext } from 'react';
import { api, refreshSession, setAccessToken, setSessionLostHandler } from '../api';

export const AuthContext = createContext({ user: null, ready: false });

// Khi tải trang: dùng refresh cookie (httpOnly) để khôi phục phiên, access token chỉ nằm trong bộ nhớ
export class AuthProvider extends Component {
  login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    setAccessToken(data.accessToken);
    this.setState({ user: data.user });
    return data.user;
  };

  logout = async () => {
    await api.post('/auth/logout').catch(() => {});
    setAccessToken(null);
    this.setState({ user: null });
  };

  reloadUser = async () => {
    const { data } = await api.get('/auth/me');
    this.setState({ user: data.user });
    return data.user;
  };

  state = { user: null, ready: false, login: this.login, logout: this.logout, reloadUser: this.reloadUser };

  async componentDidMount() {
    setSessionLostHandler(() => this.setState({ user: null }));
    const session = await refreshSession();
    this.setState({ user: session?.user || null, ready: true });
  }

  render() {
    return <AuthContext.Provider value={this.state}>{this.props.children}</AuthContext.Provider>;
  }
}
