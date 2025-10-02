'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface User {
  id: number
  username: string
  device_id: string | null
  account_type: 'trial' | 'veo3' | 'whisk' | 'all'
  status: 'active' | 'inactive' | 'banned'
  created_at: string
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  
  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    account_type: 'all' as 'trial' | 'veo3' | 'whisk' | 'all',
    status: 'active' as 'active' | 'inactive' | 'banned'
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')

  // Load user data when editing
  useEffect(() => {
    if (editingUser) {
      setFormData({
        username: editingUser.username,
        password: '', // Don't populate password
        account_type: editingUser.account_type,
        status: editingUser.status
      })
    } else {
      setFormData({
        username: '',
        password: '',
        account_type: 'all',
        status: 'active'
      })
    }
  }, [editingUser])

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching users from API route...')
      
      const response = await fetch('/api/users')
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to fetch users')
      }
      
      console.log('✅ Users fetched:', result.users?.length || 0)
      setUsers(result.users || [])
    } catch (error) {
      console.error('❌ Error fetching users:', error)
      alert('Failed to fetch users. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  const toggleUserStatus = async (userId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active'
      console.log(`🔄 Toggling user ${userId} status to ${newStatus}`)
      
      const response = await fetch(`/api/users/${userId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to toggle status')
      }
      
      console.log('✅ Status toggled successfully')
      fetchUsers()
    } catch (error: any) {
      console.error('❌ Error toggling status:', error)
      alert(error.message || 'Failed to toggle status')
    }
  }

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return
    
    setFormLoading(true)
    setFormError('')
    
    try {
      console.log('✏️ Editing user:', editingUser.id)
      
      const response = await fetch(`/api/users/${editingUser.id}/edit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password || undefined, // Only send if provided
          account_type: formData.account_type,
          status: formData.status
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update user')
      }
      
      console.log('✅ User updated successfully!')
      alert('✅ User updated successfully!')
      
      // Reset form
      setFormData({ username: '', password: '', account_type: 'all', status: 'active' })
      setEditingUser(null)
      
      // Refresh users list
      fetchUsers()
    } catch (error: any) {
      console.error('❌ Error updating user:', error)
      setFormError(error.message || 'Có lỗi xảy ra khi cập nhật user')
    } finally {
      setFormLoading(false)
    }
  }

  const deleteUser = async (userId: number) => {
    if (!confirm('Bạn có chắc muốn xóa user này?')) return
    
    try {
      console.log('🗑️ Deleting user:', userId)
      
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE'
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete user')
      }
      
      console.log('✅ User deleted successfully')
      alert('✅ User deleted successfully!')
      fetchUsers()
    } catch (error: any) {
      console.error('❌ Error deleting user:', error)
      alert(error.message || 'Failed to delete user')
    }
  }

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    
    setFormLoading(true)
    setFormError('')
    
    try {
      console.log('➕ Creating user:', formData.username)
      
      const response = await fetch('/api/users/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          account_type: formData.account_type
        })
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create user')
      }

      console.log('✅ User created successfully!')
      
      // Reset form
      setFormData({ username: '', password: '', account_type: 'all', status: 'active' })
      setShowAddModal(false)
      
      // Refresh users list
      fetchUsers()
    } catch (error: any) {
      console.error('❌ Error creating user:', error)
      setFormError(error.message || 'Có lỗi xảy ra khi tạo user')
    } finally {
      setFormLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">KZ Tool - Admin Dashboard</h1>
            <p className="text-white/70">Quản lý users và device binding</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition shadow-lg"
          >
            ➕ Add User
          </button>
        </div>

        <div className="bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-6">👥 Users ({users.length})</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/20">
                  <th className="py-3 px-4 text-white font-semibold">ID</th>
                  <th className="py-3 px-4 text-white font-semibold">Username</th>
                  <th className="py-3 px-4 text-white font-semibold">Device ID</th>
                  <th className="py-3 px-4 text-white font-semibold">Account Type</th>
                  <th className="py-3 px-4 text-white font-semibold">Status</th>
                  <th className="py-3 px-4 text-white font-semibold">Created</th>
                  <th className="py-3 px-4 text-white font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-white/10 hover:bg-white/5 transition">
                    <td className="py-3 px-4 text-white">{user.id}</td>
                    <td className="py-3 px-4 text-white font-medium">{user.username}</td>
                    <td className="py-3 px-4 text-white/70 font-mono text-xs">
                      {user.device_id ? user.device_id.substring(0, 16) + '...' : 'Not bound'}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        user.account_type === 'all' ? 'bg-purple-500 text-white' :
                        user.account_type === 'trial' ? 'bg-yellow-500 text-white' :
                        user.account_type === 'veo3' ? 'bg-blue-500 text-white' :
                        'bg-green-500 text-white'
                      }`}>
                        {user.account_type.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <button
                        onClick={() => toggleUserStatus(user.id, user.status)}
                        className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                          user.status === 'active' ? 'bg-green-500 hover:bg-green-600 text-white' : 
                          user.status === 'inactive' ? 'bg-gray-500 hover:bg-gray-600 text-white' :
                          'bg-red-500 hover:bg-red-600 text-white'
                        }`}
                      >
                        {user.status.toUpperCase()}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-white/70 text-sm">
                      {new Date(user.created_at).toLocaleDateString('vi-VN')}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition"
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => deleteUser(user.id)}
                          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 transition"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {users.length === 0 && (
            <div className="text-center py-12 text-white/50">
              No users found. Click "Add User" to create one.
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold mb-6">Add New User</h3>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {formError}
              </div>
            )}
            
            <form onSubmit={handleAddUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username *</label>
                  <input 
                    type="text" 
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter username"
                    required
                    disabled={formLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password *</label>
                  <input 
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter password"
                    required
                    disabled={formLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Account Type</label>
                  <select 
                    value={formData.account_type}
                    onChange={(e) => setFormData({...formData, account_type: e.target.value as any})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={formLoading}
                  >
                    <option value="trial">Trial (Full access - Trial account)</option>
                    <option value="veo3">Veo3 (Video only)</option>
                    <option value="whisk">Whisk (Image only)</option>
                    <option value="all">All (Full access - Paid account)</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false)
                    setFormData({ username: '', password: '', account_type: 'all', status: 'active' })
                    setFormError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-gray-400"
                  disabled={formLoading}
                >
                  {formLoading ? '⏳ Creating...' : '✅ Add User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4">
            <h3 className="text-2xl font-bold mb-6">Edit User</h3>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {formError}
              </div>
            )}
            
            <form onSubmit={handleEditUser}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Username *</label>
                  <input 
                    type="text" 
                    value={formData.username}
                    onChange={(e) => setFormData({...formData, username: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter username"
                    required
                    disabled={formLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Password (leave blank to keep current)</label>
                  <input 
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({...formData, password: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter new password or leave blank"
                    disabled={formLoading}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Account Type</label>
                  <select 
                    value={formData.account_type}
                    onChange={(e) => setFormData({...formData, account_type: e.target.value as any})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={formLoading}
                  >
                    <option value="trial">Trial (Full access - Trial account)</option>
                    <option value="veo3">Veo3 (Video only)</option>
                    <option value="whisk">Whisk (Image only)</option>
                    <option value="all">All (Full access - Paid account)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Status</label>
                  <select 
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    disabled={formLoading}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setEditingUser(null)
                    setFormData({ username: '', password: '', account_type: 'all', status: 'active' })
                    setFormError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition disabled:bg-gray-400"
                  disabled={formLoading}
                >
                  {formLoading ? '⏳ Updating...' : '✅ Update User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
