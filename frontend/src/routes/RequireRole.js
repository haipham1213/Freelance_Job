import React, { Component } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { Spinner } from '../components/ui';
import ErrorPage from '../pages/public/ErrorPage';

// Chỉ điều hướng giao diện; backend vẫn tự kiểm tra role ở mọi API
export default class RequireRole extends Component {
  static contextType = AuthContext;

  render() {
    const { user, ready } = this.context;
    if (!ready) return <Spinner />;
    if (!user) return <Navigate to={`/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`} replace />;
    if (this.props.role && user.role !== this.props.role) return <ErrorPage code={403} />;
    return <Outlet />;
  }
}
