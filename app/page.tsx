'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

interface User {
  id: number
  username: string
  device_id: string | null
  account_type: 'trial' | 'veo3' | 'whisk' | 'minimax' | 'all'
  status: 'active' | 'inactive' | 'banned'
  created_at: string
}

interface GmailAccount {
  id: number
  email: string
  ogg_ticket: string
  status: string
}

interface UserResource {
  id: number
  gmail_account_id: number
  gmail_accounts: GmailAccount
  proxy_host: string
  proxy_port: number
  proxy_username: string
  proxy_password: string
  proxy_pool_id: number | null
}

interface ProxyPool {
  id: number
  name: string
  description: string
  proxies: any[]
  is_active: boolean
  created_at: string
}

export default function UsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [authenticated, setAuthenticated] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    account_type: 'all' as 'trial' | 'veo3' | 'whisk' | 'minimax' | 'all',
    status: 'active' as 'active' | 'inactive' | 'banned'
  })
  const [formLoading, setFormLoading] = useState(false)
  const [formError, setFormError] = useState('')
  
  // Resources management states
  const [showResourcesModal, setShowResourcesModal] = useState(false)
  const [selectedUserForResources, setSelectedUserForResources] = useState<User | null>(null)
  const [gmailAccounts, setGmailAccounts] = useState<GmailAccount[]>([])
  const [userResources, setUserResources] = useState<UserResource[]>([])
  const [selectedGmails, setSelectedGmails] = useState<number[]>([])
  const [gmailSearchQuery, setGmailSearchQuery] = useState('') // Search filter
  
  // Proxy configuration states
  const [proxyPools, setProxyPools] = useState<ProxyPool[]>([])
  const [selectedProxyPoolId, setSelectedProxyPoolId] = useState<number | null>(null)
  const [useProxyPool, setUseProxyPool] = useState(true) // Toggle between pool and manual (DEFAULT: true)
  const [proxyConfig, setProxyConfig] = useState({
    host: '',
    port: 50100,
    username: '',
    password: ''
  })

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

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/check')
        const result = await response.json()

        if (response.ok && result.authenticated) {
          setAuthenticated(true)
          fetchUsers()
        } else {
          router.push('/login')
        }
      } catch (error) {
        console.error('❌ Auth check failed:', error)
        router.push('/login')
      }
    }

    checkAuth()
  }, [router])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      console.log('🔍 Fetching users from API route...')
      
      // Force fresh data with timestamp to bust cache
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/users?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })
      
      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to fetch users')
      }
      
      const result = await response.json()
      
      console.log('✅ Users fetched:', result.users?.length || 0)
      setUsers(result.users || [])
    } catch (error) {
      console.error('❌ Error fetching users:', error)
      alert('Failed to fetch users. Check console for details.')
    } finally {
      setLoading(false)
    }
  }

  // Fetch proxy pools from API
  const fetchProxyPools = async () => {
    try {
      console.log('🔍 Fetching proxy pools from API...')
      
      const timestamp = new Date().getTime()
      const response = await fetch(`/api/proxy-pools?t=${timestamp}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch proxy pools')
      }
      
      const result = await response.json()
      
      if (result.success && result.proxy_pools) {
        console.log('✅ Proxy pools fetched:', result.proxy_pools.length)
        setProxyPools(result.proxy_pools)
      }
    } catch (error) {
      console.error('❌ Error fetching proxy pools:', error)
      // Non-critical error, don't show alert
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
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to toggle status')
      }
      
      console.log('✅ Status toggled successfully')
      fetchUsers()
    } catch (error: any) {
      console.error('❌ Error toggling status:', error)
      alert(`❌ Error: ${error.message || 'Failed to toggle status'}`)
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
      
      if (!response.ok || !result.success) {
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
      
      // Check if response is JSON
      const contentType = response.headers.get('content-type')
      if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response')
      }
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to delete user')
      }
      
      console.log('✅ User deleted successfully')
      alert('✅ User deleted successfully!')
      fetchUsers()
    } catch (error: any) {
      console.error('❌ Error deleting user:', error)
      alert(`❌ Error: ${error.message || 'Failed to delete user'}`)
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
      alert('✅ User created successfully!')
      
      // Reset form
      setFormData({ username: '', password: '', account_type: 'all', status: 'active' })
      setShowAddModal(false)
      
      // Refresh users list
      await fetchUsers()
    } catch (error: any) {
      console.error('❌ Error creating user:', error)
      setFormError(error.message || 'Có lỗi xảy ra khi tạo user')
    } finally {
      setFormLoading(false)
    }
  }

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
      router.push('/login')
    } catch (error) {
      console.error('❌ Logout failed:', error)
      // Force redirect anyway
      router.push('/login')
    }
  }

  // ============================================
  // RESOURCES MANAGEMENT
  // ============================================
  
  const fetchGmailAccounts = async () => {
    try {
      const response = await fetch('/api/gmail-accounts')
      if (!response.ok) throw new Error('Failed to fetch Gmail accounts')
      const result = await response.json()
      setGmailAccounts(result.accounts || [])
    } catch (error) {
      console.error('❌ Error fetching Gmail accounts:', error)
    }
  }

  const fetchUserResources = async (userId: number) => {
    try {
      const response = await fetch(`/api/assign-resources?user_id=${userId}`)
      if (!response.ok) throw new Error('Failed to fetch user resources')
      const result = await response.json()
      setUserResources(result.resources || [])
      
      // Pre-select assigned Gmail accounts
      const assignedGmailIds = result.resources?.map((r: UserResource) => r.gmail_account_id) || []
      setSelectedGmails(assignedGmailIds)
      
      // Pre-fill proxy config (from first assignment)
      if (result.resources && result.resources.length > 0) {
        const firstResource = result.resources[0]
        setProxyConfig({
          host: firstResource.proxy_host || '',
          port: firstResource.proxy_port || 50100,
          username: firstResource.proxy_username || '',
          password: firstResource.proxy_password || ''
        })
      }
    } catch (error) {
      console.error('❌ Error fetching user resources:', error)
    }
  }

  const openResourcesModal = async (user: User) => {
    setSelectedUserForResources(user)
    setShowResourcesModal(true)
    setGmailSearchQuery('') // Reset search
    await fetchGmailAccounts()
    await fetchUserResources(user.id)
    await fetchProxyPools() // ← FETCH PROXY POOLS!
  }

  const handleAssignResources = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserForResources) return

    setFormLoading(true)
    setFormError('')

    try {
      // Build request body based on proxy mode
      const requestBody: any = {
        user_id: selectedUserForResources.id,
        gmail_account_ids: selectedGmails,
        assigned_by: 'admin'
      }
      
      // Add proxy config based on mode
      if (useProxyPool && selectedProxyPoolId) {
        requestBody.proxy_pool_id = selectedProxyPoolId
      } else if (!useProxyPool) {
        requestBody.proxy = proxyConfig
      }
      
      const response = await fetch('/api/assign-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to assign resources')
      }

      alert(`✅ ${result.message}`)
      setShowResourcesModal(false)
      setSelectedUserForResources(null)
      setSelectedGmails([])
      setGmailSearchQuery('') // Reset search
    } catch (error: any) {
      setFormError(error.message)
    } finally {
      setFormLoading(false)
    }
  }

  if (loading || !authenticated) {
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
          <div className="flex gap-3">
            <button 
              onClick={handleLogout}
              className="px-6 py-3 bg-red-500 hover:bg-red-600 text-white rounded-lg font-semibold transition shadow-lg"
            >
              🚪 Logout
            </button>
            <button 
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold transition shadow-lg"
            >
              ➕ Add User
            </button>
          </div>
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
                        user.account_type === 'minimax' ? 'bg-pink-500 text-white' :
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
                        {/* Resources button - only for minimax and all users */}
                        {(user.account_type === 'minimax' || user.account_type === 'all') && (
                          <button 
                            onClick={() => openResourcesModal(user)}
                            className="px-3 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition"
                            title="Assign Gmail & Proxy"
                          >
                            📦
                          </button>
                        )}
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
                    <option value="minimax">Minimax (Voice only)</option>
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

      {/* Assign Resources Modal */}
      {showResourcesModal && selectedUserForResources && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-xl p-8 max-w-2xl w-full mx-4 my-8">
            <h3 className="text-2xl font-bold mb-6">
              📦 Resources for {selectedUserForResources.username}
            </h3>
            
            {formError && (
              <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                {formError}
              </div>
            )}
            
            <form onSubmit={handleAssignResources}>
              {/* Gmail Accounts */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    Gmail Accounts ({selectedGmails.length} selected)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      const email = prompt('📧 Nhập Gmail:')
                      if (!email) return
                      
                      const ogg_ticket = prompt('🎫 Nhập OGG Ticket:')
                      if (!ogg_ticket) return
                      
                      // Call API to add Gmail
                      fetch('/api/gmail-accounts', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ email, ogg_ticket })
                      })
                      .then(res => res.json())
                      .then(result => {
                        if (result.success) {
                          alert('✅ Gmail account đã được thêm!')
                          fetchGmailAccounts() // Refresh list
                        } else {
                          throw new Error(result.error)
                        }
                      })
                      .catch(err => alert('❌ Lỗi: ' + err.message))
                    }}
                    className="px-3 py-1.5 bg-green-500 text-white text-sm rounded-lg hover:bg-green-600 transition"
                  >
                    ➕ Add Gmail
                  </button>
                </div>
                
                {/* Search Input */}
                <div className="mb-3">
                  <input
                    type="text"
                    value={gmailSearchQuery}
                    onChange={(e) => setGmailSearchQuery(e.target.value)}
                    placeholder="🔍 Search Gmail accounts..."
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                
                {/* Gmail List with Checkbox */}
                <div className="max-h-60 overflow-y-auto border rounded-lg p-4 bg-gray-50 space-y-2">
                  {gmailAccounts
                    .filter(gmail => 
                      gmail.email.toLowerCase().includes(gmailSearchQuery.toLowerCase())
                    )
                    .map(gmail => (
                      <div key={gmail.id} className="flex items-center gap-3 p-2 hover:bg-gray-100 rounded transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedGmails.includes(gmail.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGmails([...selectedGmails, gmail.id])
                            } else {
                              setSelectedGmails(selectedGmails.filter(id => id !== gmail.id))
                            }
                          }}
                          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        />
                        <span className="text-sm flex-1">{gmail.email}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          gmail.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {gmail.status}
                        </span>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation()
                            if (!confirm(`🗑️ Xóa Gmail "${gmail.email}" khỏi hệ thống?\n\nCảnh báo: Hành động này không thể hoàn tác!`)) return
                            
                            try {
                              const response = await fetch(`/api/gmail-accounts/${gmail.id}`, {
                                method: 'DELETE'
                              })
                              
                              if (!response.ok) throw new Error('Failed to delete Gmail account')
                              
                              alert('✅ Đã xóa Gmail account!')
                              
                              // Remove from selected list
                              setSelectedGmails(selectedGmails.filter(id => id !== gmail.id))
                              
                              // Refresh Gmail accounts list
                              await fetchGmailAccounts()
                            } catch (error: any) {
                              alert('❌ Lỗi: ' + error.message)
                            }
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded transition-colors"
                          title="Delete Gmail account"
                        >
                          🗑️
                        </button>
                      </div>
                    ))}
                  {gmailAccounts.filter(gmail => 
                    gmail.email.toLowerCase().includes(gmailSearchQuery.toLowerCase())
                  ).length === 0 && (
                    <div className="text-center py-4 text-gray-500">
                      {gmailSearchQuery ? '❌ No matching Gmail accounts' : 'No Gmail accounts available. Add them first.'}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Proxy Config */}
              <div className="mb-6 p-4 bg-gray-50 rounded-lg border">
                <h4 className="font-semibold mb-4">Proxy Configuration</h4>
                
                {/* Toggle: Proxy Pool vs Manual Proxy */}
                <div className="mb-4 flex items-center gap-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={useProxyPool}
                      onChange={() => setUseProxyPool(true)}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Use Proxy Pool (Recommended)</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="radio"
                      checked={!useProxyPool}
                      onChange={() => setUseProxyPool(false)}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium">Manual Single Proxy</span>
                  </label>
                </div>
                
                {/* Proxy Pool Dropdown */}
                {useProxyPool && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-2">
                      Select Proxy Pool 
                      <span className="text-xs text-gray-500 ml-2">(Multiple IPs for anti-ban)</span>
                    </label>
                    <select
                      value={selectedProxyPoolId || ''}
                      onChange={(e) => setSelectedProxyPoolId(e.target.value ? Number(e.target.value) : null)}
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Select Proxy Pool --</option>
                      {proxyPools.map(pool => (
                        <option key={pool.id} value={pool.id}>
                          {pool.name} ({pool.proxies?.length || 0} proxies)
                        </option>
                      ))}
                    </select>
                    {proxyPools.length === 0 && (
                      <p className="text-sm text-orange-600 mt-2">
                        ⚠️ No proxy pools available. Contact admin to create proxy pools.
                      </p>
                    )}
                  </div>
                )}
                
                {/* Manual Proxy Fields */}
                {!useProxyPool && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Host</label>
                      <input
                        type="text"
                        value={proxyConfig.host}
                        onChange={(e) => setProxyConfig({...proxyConfig, host: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="208.214.165.10"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Port</label>
                      <input
                        type="number"
                        value={proxyConfig.port}
                        onChange={(e) => setProxyConfig({...proxyConfig, port: Number(e.target.value)})}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="50100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Username</label>
                      <input
                        type="text"
                        value={proxyConfig.username}
                        onChange={(e) => setProxyConfig({...proxyConfig, username: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="proxy_username"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Password</label>
                      <input
                        type="text"
                        value={proxyConfig.password}
                        onChange={(e) => setProxyConfig({...proxyConfig, password: e.target.value})}
                        className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="proxy_password"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              {/* Current Assignments */}
              {userResources.length > 0 && (
                <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-semibold mb-2 text-blue-900">Current Assignments:</h4>
                  <ul className="text-sm text-blue-800 space-y-2">
                    {userResources.map(r => (
                      <li key={r.id} className="flex items-center justify-between p-2 bg-white rounded">
                        <span>✓ {r.gmail_accounts.email}</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm(`🗑️ Unassign "${r.gmail_accounts.email}" từ user này?`)) return
                            
                            try {
                              const response = await fetch(`/api/assign-resources?id=${r.id}`, {
                                method: 'DELETE'
                              })
                              
                              if (!response.ok) throw new Error('Failed to unassign')
                              
                              alert('✅ Đã xóa assignment!')
                              
                              // Refresh user resources
                              if (selectedUserForResources) {
                                await fetchUserResources(selectedUserForResources.id)
                              }
                            } catch (error: any) {
                              alert('❌ Lỗi: ' + error.message)
                            }
                          }}
                          className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded transition-colors"
                          title="Unassign this Gmail"
                        >
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowResourcesModal(false)
                    setSelectedUserForResources(null)
                    setSelectedGmails([])
                    setGmailSearchQuery('') // Reset search
                    setFormError('')
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                  disabled={formLoading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition disabled:bg-gray-400"
                  disabled={formLoading}
                >
                  {formLoading ? '⏳ Assigning...' : '✅ Assign Resources'}
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
                    <option value="minimax">Minimax (Voice only)</option>
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
