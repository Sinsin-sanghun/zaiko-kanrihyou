import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import toast from 'react-hot-toast'
import { insertEditLog, confirmEmptyComment } from '../lib/editLogger'

export default function UserManagementPage({ session }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('editor')

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('*')
      .order('created_at', { ascending: true })

    if (error) {
      toast.error('ユーザー一覧の取得に失敗しました')
    } else {
      setUsers(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAddUser = async (e) => {
    e.preventDefault()
    if (!newEmail.endsWith('@shirokumapower.com')) {
      toast.error('@shirokumapower.com のメールアドレスのみ追加できます')
      return
    }

    const addComment = prompt('追加コメント（任意）:') ?? ''
    if (addComment === '' && !confirmEmptyComment('')) return

    const { data, error } = await supabase
      .from('user_roles')
      .insert({ email: newEmail, role: newRole })
      .select()

    if (error) {
      if (error.code === '23505') {
        toast.error('このメールアドレスは既に登録されています')
      } else {
        toast.error('ユーザーの追加に失敗しました')
      }
    } else {
      // 編集ログを記録
      await insertEditLog({
        tableName: 'user_roles',
        recordId: data?.[0]?.id || newEmail,
        actionType: 'create',
        userEmail: session?.user?.email,
        comment: addComment.trim(),
        details: { added_email: newEmail, role: newRole },
      })
      toast.success('ユーザーを追加しました')
      setNewEmail('')
      setNewRole('editor')
      fetchUsers()
    }
  }

  const handleRoleChange = async (id, email, role) => {
    const currentUser = users.find((u) => u.id === id)
    const oldRole = currentUser?.role

    const changeComment = prompt('権限変更コメント（任意）:') ?? ''
    if (changeComment === '' && !confirmEmptyComment('')) return

    const { error } = await supabase
      .from('user_roles')
      .update({ role })
      .eq('id', id)

    if (error) {
      toast.error('権限の変更に失敗しました')
    } else {
      // 編集ログを記録
      await insertEditLog({
        tableName: 'user_roles',
        recordId: id,
        actionType: 'update',
        userEmail: session?.user?.email,
        comment: changeComment.trim(),
        details: { email: email, old_role: oldRole, new_role: role },
      })
      toast.success(email + ' の権限を変更しました')
      fetchUsers()
    }
  }

  const handleDeleteUser = async (id, email) => {
    if (!confirm(email + ' を削除しますか？')) return

    const deleteComment = prompt('削除コメント（任意）:') ?? ''
    if (deleteComment === '' && !confirmEmptyComment('')) return

    const { error } = await supabase
      .from('user_roles')
      .delete()
      .eq('id', id)

    if (error) {
      toast.error('ユーザーの削除に失敗しました')
    } else {
      // 編集ログを記録
      await insertEditLog({
        tableName: 'user_roles',
        recordId: id,
        actionType: 'delete',
        userEmail: session?.user?.email,
        comment: deleteComment.trim(),
        details: { deleted_email: email },
      })
      toast.success(email + ' を削除しました')
      fetchUsers()
    }
  }

  const roleLabel = (role) => {
    switch (role) {
      case 'admin': return '管理者'
      case 'editor': return '編集者'
      case 'viewer': return '閲覧者'
      default: return role
    }
  }

  const roleBadgeColor = (role) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800'
      case 'editor': return 'bg-blue-100 text-blue-800'
      case 'viewer': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-slate-800 mb-6">ユーザー管理</h1>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">ユーザー追加</h2>
        <form onSubmit={handleAddUser} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-slate-600 mb-1">メールアドレス</label>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="user@shirokumapower.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div className="w-40">
            <label className="block text-sm font-medium text-slate-600 mb-1">権限</label>
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="editor">編集者</option>
              <option value="admin">管理者</option>
            </select>
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 transition-colors"
          >
            追加
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-700">登録ユーザー一覧</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 text-left">
                <th className="px-6 py-3 text-sm font-medium text-slate-600">メールアドレス</th>
                <th className="px-6 py-3 text-sm font-medium text-slate-600">現在の権限</th>
                <th className="px-6 py-3 text-sm font-medium text-slate-600">権限変更</th>
                <th className="px-6 py-3 text-sm font-medium text-slate-600">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-6 py-3 text-sm text-slate-800">{user.email}</td>
                  <td className="px-6 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${roleBadgeColor(user.role)}`}>
                      {roleLabel(user.role)}
                    </span>
                  </td>
                  <td className="px-6 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleRoleChange(user.id, user.email, e.target.value)}
                      className="px-2 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="viewer">閲覧者</option>
                      <option value="editor">編集者</option>
                      <option value="admin">管理者</option>
                    </select>
                  </td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="text-red-600 hover:text-red-800 text-sm font-medium"
                    >
                      削除
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 mb-4">
        <p>💡 <span className="font-semibold">@shirokumapower.com</span> のアカウントでログインした社員は、自動的に<span className="font-semibold">閲覧者</span>としてアクセスできます。手動での登録は不要です。</p>
        <p className="mt-1 text-blue-600">ここでは<span className="font-semibold">編集者・管理者</span>への昇格が必要なユーザーのみ登録してください。</p>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 text-sm text-slate-600">
        <h3 className="font-semibold mb-2">権限の説明</h3>
        <ul className="space-y-1">
          <li><span className="font-medium text-red-700">管理者 (admin)</span>：全操作可能 + ユーザー管理</li>
          <li><span className="font-medium text-blue-700">編集者 (editor)</span>：データの追加・編集可能（削除不可）</li>
          <li><span className="font-medium text-gray-700">閲覧者 (viewer)</span>：閲覧のみ（@shirokumapower.com の社員は自動付与）</li>
        </ul>
      </div>
    </div>
  )
}
