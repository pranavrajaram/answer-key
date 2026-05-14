'use client'

import { useState } from 'react'
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
    <div className="ak-card p-6">
      <h2 className="mb-4 font-semibold text-stone-900">
        Comments {comments.length > 0 && <span className="text-sm font-normal text-stone-400">({comments.length})</span>}
      </h2>

      <form onSubmit={handleSubmit} className="mb-5">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="Add a comment…"
          maxLength={500}
          rows={2}
          className="ak-field resize-none"
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-xs text-stone-400">{text.length}/500</span>
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="rounded-lg bg-stone-950 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-stone-800 disabled:opacity-40"
          >
            {loading ? 'Posting…' : 'Post'}
          </button>
        </div>
        {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
      </form>

      {comments.length === 0 ? (
        <p className="py-4 text-center text-sm text-stone-400">No comments yet.</p>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-0.5">
                  <span className={`text-sm font-medium ${comment.user_id === currentUserId ? 'text-teal-700' : 'text-stone-800'}`}>
                    {comment.profiles?.username ?? 'unknown'}
                  </span>
                  <span className="text-xs text-stone-400">{timeAgo(comment.created_at)}</span>
                </div>
                <p className="break-words text-sm leading-relaxed text-stone-700">{comment.content}</p>
              </div>
              {comment.user_id === currentUserId && (
                <button
                  onClick={() => handleDelete(comment.id)}
                  className="shrink-0 self-start pt-0.5 text-xs text-stone-300 transition-colors hover:text-red-400"
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
