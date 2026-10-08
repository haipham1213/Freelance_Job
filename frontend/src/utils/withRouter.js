import React from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';

// Class component không dùng được hook → bọc để nhận params/navigate qua props
export default function withRouter(Component) {
  return function WithRouter(props) {
    const [searchParams, setSearchParams] = useSearchParams();
    return <Component {...props} params={useParams()} navigate={useNavigate()} location={useLocation()} searchParams={searchParams} setSearchParams={setSearchParams} />;
  };
}
