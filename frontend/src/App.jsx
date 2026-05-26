import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  Inbox,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Plus,
  Filter,
  Check,
  ChevronLeft,
  ChevronRight,
  Trash2,
  RefreshCw,
  Mail,
  Calendar,
  AlertOctagon,
  FileText
} from 'lucide-react';
import './App.css';

const API_URL = 'http://localhost:5000/tickets';
const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'closed'];

function App() {
  // States
  const [tickets, setTickets] = useState([]);
  const [stats, setStats] = useState({
    totalTickets: 0,
    statusCounts: { open: 0, in_progress: 0, resolved: 0, closed: 0 },
    priorityCounts: { low: 0, medium: 0, high: 0, urgent: 0 },
    breachedCount: 0,
    avgAgeOpenMinutes: 0,
    avgResolutionTimeMinutes: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [priorityFilter, setPriorityFilter] = useState('');
  const [breachedFilter, setBreachedFilter] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    description: '',
    customerEmail: '',
    priority: 'low'
  });
  const [formErrors, setFormErrors] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Real-time Age Ticker
  const [ticker, setTicker] = useState(0);

  // Interval for age ticking
  useEffect(() => {
    const timer = setInterval(() => {
      setTicker((prev) => prev + 1);
    }, 30000); // Rerender ages every 30 seconds
    return () => clearInterval(timer);
  }, []);

  // Fetch Tickets and Stats
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Build fetch URL with filters
      let ticketFetchUrl = API_URL;
      const params = [];
      if (priorityFilter) params.push(`priority=${priorityFilter}`);
      if (breachedFilter) params.push(`breached=true`);
      if (params.length > 0) {
        ticketFetchUrl += `?${params.join('&')}`;
      }

      // Parallel fetch for tickets and stats to optimize loading times
      const [ticketsRes, statsRes] = await Promise.all([
        axios.get(ticketFetchUrl),
        axios.get(`${API_URL}/stats`)
      ]);

      if (ticketsRes.data.success) {
        setTickets(ticketsRes.data.data);
      }
      if (statsRes.data.success) {
        setStats(statsRes.data.stats);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Could not connect to backend server. Make sure the Node.js API is running.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [priorityFilter, breachedFilter]);

  // Create Ticket Submit Handler
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setFormErrors([]);
    setSubmitting(true);

    try {
      const res = await axios.post(API_URL, formData);
      if (res.data.success) {
        // Reset form & Close modal
        setFormData({
          subject: '',
          description: '',
          customerEmail: '',
          priority: 'low'
        });
        setShowCreateModal(false);
        // Refresh entire board and stats
        await fetchData();
      }
    } catch (err) {
      console.error('Error creating ticket:', err);
      if (err.response && err.response.data) {
        const errorData = err.response.data;
        if (errorData.messages) {
          setFormErrors(errorData.messages);
        } else if (errorData.error) {
          setFormErrors([errorData.error]);
        } else {
          setFormErrors(['Failed to create ticket. Please check input fields.']);
        }
      } else {
        setFormErrors(['Network error. Could not connect to API server.']);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Move Ticket between adjacent statuses
  const handleMoveStatus = async (ticketId, currentStatus, direction) => {
    const currentIndex = STATUS_ORDER.indexOf(currentStatus);
    let targetIndex = currentIndex + direction;

    if (targetIndex < 0 || targetIndex >= STATUS_ORDER.length) return;
    const targetStatus = STATUS_ORDER[targetIndex];

    try {
      // Optimistic Update locally to guarantee ultra-fast, smooth transitions
      const updatedTickets = tickets.map((t) => {
        const id = t.id || t._id;
        if (id === ticketId) {
          // Compute optimistic resolvedAt
          let optResolvedAt = t.resolvedAt;
          if (['resolved', 'closed'].includes(targetStatus)) {
            if (!optResolvedAt) optResolvedAt = new Date().toISOString();
          } else {
            optResolvedAt = null;
          }

          return { ...t, status: targetStatus, resolvedAt: optResolvedAt };
        }
        return t;
      });
      setTickets(updatedTickets);

      // Perform backend update
      const res = await axios.patch(`${API_URL}/${ticketId}`, { status: targetStatus });

      if (res.data.success) {
        // Refetch stats to keep count totals matching exactly
        const statsRes = await axios.get(`${API_URL}/stats`);
        if (statsRes.data.success) {
          setStats(statsRes.data.stats);
        }
      }
    } catch (err) {
      console.error('Error shifting ticket status:', err);
      // Revert optimistic update on failure
      fetchData();
      if (err.response && err.response.data && err.response.data.error) {
        alert(`Failed to move ticket: ${err.response.data.error}`);
      } else {
        alert('Failed to move ticket due to a network connection error.');
      }
    }
  };

  // Delete Ticket
  const handleDeleteTicket = async (ticketId) => {
    if (!window.confirm('Are you sure you want to delete this support ticket?')) return;

    try {
      const res = await axios.delete(`${API_URL}/${ticketId}`);
      if (res.data.success) {
        // Remove from local list
        setTickets(tickets.filter((t) => (t.id || t._id) !== ticketId));
        // Refresh Stats Strip
        const statsRes = await axios.get(`${API_URL}/stats`);
        if (statsRes.data.success) {
          setStats(statsRes.data.stats);
        }
      }
    } catch (err) {
      console.error('Error deleting ticket:', err);
      alert('Could not delete the ticket. Make sure backend is running.');
    }
  };

  // Seed Dummy Tickets helper
  const handleSeedData = async () => {
    if (
      !window.confirm(
        'This will clear all current tickets in the database and seed 5 highly diverse dummy tickets (including past breached & resolved tickets) for testing SLA and analytics calculations. Proceed?'
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(`${API_URL}/seed?clear=true`);
      if (res.data.success) {
        // Fetch fresh tickets and stats
        await fetchData();
      }
    } catch (err) {
      console.error('Error seeding data:', err);
      alert('Failed to seed testing data. Make sure backend server is connected.');
    } finally {
      setLoading(false);
    }
  };

  // Human-readable Age Formatter
  const formatAge = (createdAt, resolvedAt) => {
    const end = resolvedAt ? new Date(resolvedAt) : new Date();
    const created = new Date(createdAt);
    const diffMs = end - created;
    const diffMin = Math.max(0, diffMs / (1000 * 60));

    if (diffMin < 1) {
      return 'Just now';
    }
    if (diffMin < 60) {
      return `${Math.round(diffMin)}m ago`;
    }
    const diffHours = diffMin / 60;
    if (diffHours < 24) {
      return `${diffHours.toFixed(1)}h ago`;
    }
    const diffDays = diffHours / 24;
    return `${diffDays.toFixed(1)}d ago`;
  };

  // Helper: Get SLA status limit text
  const getSlaLimitText = (priority) => {
    switch (priority) {
      case 'urgent': return '1h target';
      case 'high': return '4h target';
      case 'medium': return '24h target';
      case 'low': return '72h target';
      default: return '';
    }
  };

  return (
    <div className="app-container">
      {/* Brand Header */}
      <header className="app-header">
        <div className="brand-section">
          <CheckCircle2 className="logo-icon" />
          <h1 className="brand-title">SLA Support Board</h1>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary" onClick={handleSeedData} title="Seeding helper">
            <RefreshCw className="w-4 h-4" /> Seed Testing Data
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4" /> Create Ticket
          </button>
        </div>
      </header>

      {/* Stats Dashboard strip */}
      <section className="stats-strip">
        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ color: 'var(--primary)' }}>
            <Inbox className="w-5 h-5" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.totalTickets}</span>
            <span className="stat-label">Total Tickets</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ color: 'var(--status-open)' }}>
            <Clock className="w-5 h-5" />
          </div>
          <div className="stat-info">
            <span className="stat-value">
              {stats.statusCounts.open + stats.statusCounts.in_progress}
            </span>
            <span className="stat-label">Active Tickets</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ color: 'var(--status-resolved)' }}>
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="stat-info">
            <span className="stat-value">
              {stats.statusCounts.resolved + stats.statusCounts.closed}
            </span>
            <span className="stat-label">Resolved / Closed</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ color: 'var(--priority-urgent)' }}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="stat-info">
            <span className="stat-value">{stats.breachedCount}</span>
            <span className="stat-label">SLA Breached</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-wrapper" style={{ color: 'var(--priority-medium)' }}>
            <Clock className="w-5 h-5" />
          </div>
          <div className="stat-info">
            <span className="stat-value">
              {stats.avgAgeOpenMinutes < 60
                ? `${Math.round(stats.avgAgeOpenMinutes)}m`
                : `${(stats.avgAgeOpenMinutes / 60).toFixed(1)}h`}
            </span>
            <span className="stat-label">Avg. Open Age</span>
          </div>
        </div>
      </section>

      {/* Filter and Query Strip */}
      <section className="filters-strip">
        <div className="filter-group">
          <div className="filter-label">
            <Filter className="w-4 h-4" /> Filters:
          </div>
          <select
            className="filter-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="filter-group">
          <div
            className="breached-toggle"
            onClick={() => setBreachedFilter(!breachedFilter)}
          >
            <div className={`checkbox-custom ${breachedFilter ? 'checked' : ''}`}>
              {breachedFilter && <Check className="checkbox-icon" />}
            </div>
            <span>Show SLA Breached Only</span>
          </div>
        </div>
      </section>

      {/* Connection / Backend Server Error */}
      {error && (
        <div className="form-error" style={{ margin: 0 }}>
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 inline" /> {error}
          </div>
        </div>
      )}

      {/* Kanban Board Grid */}
      {loading && tickets.length === 0 ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '64px', color: 'var(--text-muted)' }}>
          <RefreshCw className="animate-spin w-8 h-8" />
        </div>
      ) : (
        <main className="board-grid">
          {STATUS_ORDER.map((columnStatus) => {
            const columnTickets = tickets.filter((t) => t.status === columnStatus);
            let displayTitle = '';
            let colClass = '';

            switch (columnStatus) {
              case 'open':
                displayTitle = 'Open';
                colClass = 'open-col';
                break;
              case 'in_progress':
                displayTitle = 'In Progress';
                colClass = 'inprogress-col';
                break;
              case 'resolved':
                displayTitle = 'Resolved';
                colClass = 'resolved-col';
                break;
              case 'closed':
                displayTitle = 'Closed';
                colClass = 'closed-col';
                break;
            }

            return (
              <div key={columnStatus} className={`board-column ${colClass}`}>
                {/* Column Header */}
                <div className="column-header">
                  <span className="column-title">
                    <span
                      style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: `var(--status-${columnStatus.replace('_', '')})`
                      }}
                    ></span>
                    {displayTitle}
                  </span>
                  <span className="column-badge">{columnTickets.length}</span>
                </div>

                {/* Column Tickets Container */}
                <div className="cards-container">
                  {columnTickets.length === 0 ? (
                    <div className="empty-col-message">
                      <Inbox className="empty-icon" />
                      <span className="empty-title">No tickets</span>
                    </div>
                  ) : (
                    columnTickets.map((ticket) => {
                      const id = ticket.id || ticket._id;
                      const hasSlaBreached = ticket.slaBreached;

                      return (
                        <div
                          key={id}
                          className={`ticket-card ${hasSlaBreached ? 'breached-card' : ''}`}
                        >
                          <div className="card-header">
                            <span className={`priority-badge priority-${ticket.priority}`}>
                              {ticket.priority}
                            </span>

                            {hasSlaBreached ? (
                              <span className="sla-indicator animate-pulse-red">
                                <span className="sla-dot"></span>
                                BREACHED
                              </span>
                            ) : (
                              <span
                                className="sla-limit"
                                style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 500 }}
                              >
                                {getSlaLimitText(ticket.priority)}
                              </span>
                            )}
                          </div>

                          <h3 className="ticket-subject">{ticket.subject}</h3>
                          {ticket.description && (
                            <p className="ticket-desc">{ticket.description}</p>
                          )}

                          <div className="ticket-meta">
                            <div className="meta-row">
                              <Mail className="meta-icon" />
                              <span style={{ wordBreak: 'break-all' }}>{ticket.customerEmail}</span>
                            </div>
                            <div className="meta-row">
                              <Calendar className="meta-icon" />
                              <span>Age: {formatAge(ticket.createdAt, ticket.resolvedAt)}</span>
                            </div>
                          </div>

                          {/* Control arrows for adjacent shifts */}
                          <div className="card-controls">
                            {/* Move Prev (Left) Button */}
                            {columnStatus !== 'open' ? (
                              <button
                                className="btn-ctrl"
                                onClick={() => handleMoveStatus(id, columnStatus, -1)}
                                title="Move back 1 step"
                              >
                                <ChevronLeft className="w-4 h-4" /> Prev
                              </button>
                            ) : (
                              <div style={{ flex: 1 }}></div>
                            )}

                            {/* Delete Action button */}
                            <button
                              className="delete-btn-card"
                              onClick={() => handleDeleteTicket(id)}
                              title="Delete support ticket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Move Next (Right) Button */}
                            {columnStatus !== 'closed' ? (
                              <button
                                className="btn-ctrl"
                                onClick={() => handleMoveStatus(id, columnStatus, 1)}
                                title="Move forward 1 step"
                              >
                                Next <ChevronRight className="w-4 h-4" />
                              </button>
                            ) : (
                              <div style={{ flex: 1 }}></div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </main>
      )}

      {/* Create Ticket Modal Backdrop & Sheet */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Create Support Ticket</h2>
              <button className="btn-close" onClick={() => setShowCreateModal(false)}>
                <RefreshCw className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit}>
              <div className="modal-body">
                {formErrors.length > 0 && (
                  <div className="form-error">
                    {formErrors.map((err, i) => (
                      <div key={i} className="flex items-center gap-1">
                        • {err}
                      </div>
                    ))}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Customer Email</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    placeholder="e.g. john.doe@client.com"
                    value={formData.customerEmail}
                    onChange={(e) => setFormData({ ...formData, customerEmail: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Subject</label>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    className="form-input"
                    placeholder="e.g. App crashing on payment page"
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea
                    required
                    className="form-textarea"
                    placeholder="Describe the technical issue detailedly..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select
                    className="form-select"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                  >
                    <option value="low">Low (72h SLA)</option>
                    <option value="medium">Medium (24h SLA)</option>
                    <option value="high">High (4h SLA)</option>
                    <option value="urgent">Urgent (1h SLA)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowCreateModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn btn-primary">
                  {submitting ? 'Creating...' : 'Create Ticket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
