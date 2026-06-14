"use client";

import { useState } from "react";
import TaskActivityList from "./TaskActivityList";
import TaskCommentsList from "./TaskCommentsList";

export default function TaskDetailFeedTabs({
  activity,
  comments,
  userNamesById,
  canComment,
  commentText,
  onCommentChange,
  onPostComment,
  postingComment
}) {
  const activityCount = (activity || []).length;
  const commentCount = (comments || []).length;
  const defaultTab = canComment && commentCount > 0 ? "comments" : "activity";
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <div className="task-detail-feed-card">
      <div className="task-detail-feed-tabs" role="tablist" aria-label="Task feed">
        <div className="task-detail-feed-switch">
          <button
            type="button"
            role="tab"
            id="task-feed-tab-activity"
            aria-selected={activeTab === "activity"}
            aria-controls="task-feed-panel-activity"
            className={`task-detail-feed-switch-btn${activeTab === "activity" ? " is-active" : ""}`}
            onClick={() => setActiveTab("activity")}
          >
            Activity
            {activityCount > 0 ? <span className="task-detail-feed-tab-count">{activityCount}</span> : null}
          </button>
          <button
            type="button"
            role="tab"
            id="task-feed-tab-comments"
            aria-selected={activeTab === "comments"}
            aria-controls="task-feed-panel-comments"
            className={`task-detail-feed-switch-btn${activeTab === "comments" ? " is-active" : ""}`}
            onClick={() => setActiveTab("comments")}
          >
            Comments
            {commentCount > 0 ? <span className="task-detail-feed-tab-count">{commentCount}</span> : null}
          </button>
        </div>
      </div>

      <div className="task-detail-feed-body">
        <div
          id="task-feed-panel-activity"
          role="tabpanel"
          aria-labelledby="task-feed-tab-activity"
          hidden={activeTab !== "activity"}
          className="task-detail-feed-panel"
        >
          <TaskActivityList rows={activity} userNamesById={userNamesById} />
        </div>

        <div
          id="task-feed-panel-comments"
          role="tabpanel"
          aria-labelledby="task-feed-tab-comments"
          hidden={activeTab !== "comments"}
          className="task-detail-feed-panel"
        >
          <TaskCommentsList rows={comments} userNamesById={userNamesById} />
          {canComment ? (
            <div className="task-detail-comment-composer">
              <label className="task-field task-field--comment">
                <span className="task-field-label">Add a comment</span>
                <textarea
                  className="task-textarea"
                  rows={3}
                  value={commentText}
                  onChange={(e) => onCommentChange?.(e.target.value)}
                  placeholder="Write an update…"
                />
              </label>
              <button
                type="button"
                className="master-btn master-btn-sm master-btn-outline task-detail-post-comment-btn"
                disabled={!commentText.trim() || postingComment}
                onClick={onPostComment}
              >
                {postingComment ? "Posting…" : "Post comment"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
