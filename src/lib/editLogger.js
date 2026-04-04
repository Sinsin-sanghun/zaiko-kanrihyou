import { supabase } from './supabase'

/**
 * 編集ログをedit_logsテーブルに記録する
 */
export async function insertEditLog({ tableName, recordId, actionType, userEmail, comment, details }) {
  const { error } = await supabase.from('edit_logs').insert({
    table_name: tableName,
    record_id: String(recordId),
    action_type: actionType,
    user_email: userEmail || 'unknown',
    comment: comment || null,
    details: details || null,
  })
  if (error) {
    console.error('Edit log insert failed:', error)
  }
}

/**
 * コメント未記入時の確認アラートを表示する
 */
export function confirmEmptyComment(comment) {
  if (!comment || !comment.trim()) {
    return window.confirm('何も記載されてないですが、大丈夫ですか？')
  }
  return true
}
