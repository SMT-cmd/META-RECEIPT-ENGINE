import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './style.css';

const root=document.getElementById('root');
if(!root)throw Error('The application root is missing.');
createRoot(root).render(<React.StrictMode><App/></React.StrictMode>);
