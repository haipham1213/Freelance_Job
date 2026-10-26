import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/home.css';
import './styles/jobs.css';
import './styles/public.css';
import './styles/student.css';
import './styles/employer.css';
import './styles/admin.css';
import './styles/hero.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
