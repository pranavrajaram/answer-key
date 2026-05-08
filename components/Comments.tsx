'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Comment {
  id: string
  user_id: string
  content: string
  created_at: string
  profiles?: { username: string }
}

interface CommentsProps {
  marketId: string
  currentUserId: string
  initialComments: Comment[]
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function Comments({ marketId, currentUserId, initialComments }: CommentsProps) {
  const router = useRouter()
  const supabase = createClient()

  const [comments, setComments] = useState<Comment[]>(initialComments)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    setError(null)

    const { data, error: err } = await supabase
      .from('comments')
      .insert({ market_id: marketId, user_id: currentUserId, content: text.trim() })
      .select('*, profiles(username)')
      .single()

    if (err) {
      setError(err.message)
    } else {
      setComments(prev => [data as Comment, ...prev])
      setText('')
    }
    setLoading(false)
  }

  async function handleDelete(commentId: string) {
    const { error: err } = await supabase
      .from('comments')
      .delete()
      .eq('id', commentId)

    if (!err) {
      setComments(prev => prev.filter(c => c.id !== commentId))
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h2 className="font-semibold text-gray-900 mb-4">
        Comments {comments.length > 0 && <span className="text-gray-400 font-normal text-sm">({comments.length})</span>}
      </h2>

      <form onSubmit={handleSubmit} className="mb-5">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a comment…"
          maxLength={500}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent placeholder-gray-400"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-gray-400">{text.length}/500</span>
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="bg-gray-900 hover:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            {loading ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
      </form>

      {comments.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-sm font-medium ${comment.user_id === currentUserId ? 'text-teal-700' : 'text-gray-800'}`}>
                    {comment.profiles?.username ?? 'unknown'}
                  </span>
                  <span className="text-xs text-gray-400">{timeAgo(comment.created_at)}</span>
                </div>
                <p className="text-sm text-gray-700 break-words">{comment.content}</p>
              </div>
              {comment.user_id === currentUserId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="text-gray-300 hover:text-red-400 text-xs transition-colors shrink-0 self-start pt-0.5"
                  title="Delete"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
