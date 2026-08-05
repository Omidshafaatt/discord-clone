import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';

export default function Register() {
  const { register: registerUser } = useAuth();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [serverError, setServerError] = useState('');

  const onSubmit = async (data) => {
    const formData = new FormData();
    formData.append('phone_number', data.phone_number);
    formData.append('name', data.name);
    formData.append('password', data.password);
    if (data.username) formData.append('username', data.username);
    if (data.bio) formData.append('bio', data.bio);
    if (data.profile_photo && data.profile_photo[0]) {
      formData.append('profile_photo', data.profile_photo[0]);
    }

    const result = await registerUser(formData);
    if (result.success) {
      navigate('/');
    } else {
      setServerError(result.error);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="bg-white p-8 rounded shadow-md w-96">
        <h2 className="text-2xl font-bold mb-6 text-center">Register</h2>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Phone Number *</label>
            <input
              {...register('phone_number', { required: 'Phone number is required' })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            {errors.phone_number && <p className="text-red-500 text-xs">{errors.phone_number.message}</p>}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Full Name *</label>
            <input
              {...register('name', { required: 'Name is required' })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            {errors.name && <p className="text-red-500 text-xs">{errors.name.message}</p>}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Password *</label>
            <input
              type="password"
              {...register('password', { required: 'Password is required', minLength: { value: 6, message: 'Min 6 chars' } })}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
            {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Username (optional)</label>
            <input
              {...register('username')}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Bio (optional)</label>
            <input
              {...register('bio')}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Profile Photo (optional)</label>
            <input
              type="file"
              accept="image/*"
              {...register('profile_photo')}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          {serverError && <p className="text-red-500 text-sm mb-4">{serverError}</p>}
          <button
            type="submit"
            className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
          >
            Register
          </button>
        </form>
        <p className="mt-4 text-sm text-center">
          Already have an account? <Link to="/login" className="text-blue-600 hover:underline">Login</Link>
        </p>
      </div>
    </div>
  );
}