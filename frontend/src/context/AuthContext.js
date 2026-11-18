import React, { Component, createContext } from 'react';
import { api, refreshSession, setAccessToken, setSessionLostHandler } from '../api';

export const AuthContext = createContext({ user: null, ready: false });

// Khi tải trang: dùng refresh cookie (httpOnly) để khôi phục phiên, access token chỉ nằm trong bộ nhớ
export class AuthProvider extends Component {
  signIn = async (path, body) => {
    const { data } = await api.post(path, body);
    setAccessToken(data.accessToken);
    this.setState({ user: data.user });
    return data.user;
  };

  login = (email, password) => this.signIn('/auth/login', { email, password });

  // role chỉ gửi từ trang Đăng ký (tạo tài khoản mới); trang Đăng nhập không gửi
  loginWithGoogle = (credential, role) => this.signIn('/auth/google', { credential, role });

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

  state = { user: null, ready: false, login: this.login, loginWithGoogle: this.loginWithGoogle, logout: this.logout, reloadUser: this.reloadUser };

  async componentDidMount() {
    setSessionLostHandler(() => this.setState({ user: null }));
    const session = await refreshSession();
    this.setState({ user: session?.user || null, ready: true });
  }

  render() {
    return <AuthContext.Provider value={this.state}>{this.props.children}</AuthContext.Provider>;
  }
}
