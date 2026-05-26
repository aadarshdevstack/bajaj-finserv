import { Ticket } from "../model/ticket.model.js";
import { asyncHandler } from "../utils/AsyncHandler.js";

export const createTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.create(req.body);

  res.status(201).json({
    success: true,
    ticket
  });
});

const LIMITS = {
  urgent: 60,
  high: 240,
  medium: 1440,
  low: 4320
};

const getAge = (t) => {
  const end = t.resolvedAt || new Date();
  return Math.floor((end - t.createdAt) / 60000);
};

const isBreached = (t) => getAge(t) > LIMITS[t.priority];

export const getTickets = asyncHandler(async (req, res) => {
  const { status, priority, breached } = req.query;

  let filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  let tickets = await Ticket.find(filter);

  tickets = tickets.map((t) => ({
    ...t.toObject(),
    ageMinutes: getAge(t),
    slaBreached: isBreached(t)
  }));

  if (breached === "true") {
    tickets = tickets.filter((t) => t.slaBreached);
  }

  res.json({
    success: true,
    tickets
  });
});


const allowed = {
  open: ["in_progress"],
  in_progress: ["resolved"],
  resolved: ["in_progress", "closed"],
  closed: []
};

export const updateTicket = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const ticket = await Ticket.findById(id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: "Ticket not found"
    });
  }

  if (status && !allowed[ticket.status].includes(status)) {
    return res.status(400).json({
      success: false,
      message: "Invalid status transition"
    });
  }

  ticket.status = status || ticket.status;

  if (ticket.status === "resolved") {
    ticket.resolvedAt = new Date();
  }

  if (ticket.status !== "resolved") {
    ticket.resolvedAt = null;
  }

  await ticket.save();

  res.json({
    success: true,
    ticket
  });
});

export const deleteTicket = asyncHandler(async (req, res) => {
  const ticket = await Ticket.findByIdAndDelete(req.params.id);

  if (!ticket) {
    return res.status(404).json({
      success: false,
      message: "Ticket not found"
    });
  }

  res.json({
    success: true,
    message: "Ticket deleted"
  });
});

export const getStats = asyncHandler(async (req, res) => {
  const statusStats = await Ticket.aggregate([
    { $group: { _id: "$status", count: { $sum: 1 } } }
  ]);

  const priorityStats = await Ticket.aggregate([
    { $group: { _id: "$priority", count: { $sum: 1 } } }
  ]);

  const all = await Ticket.find();

  const LIMITS = {
    urgent: 60,
    high: 240,
    medium: 1440,
    low: 4320
  };

  const breachedCount = all.filter((t) => {
    const age = (new Date() - t.createdAt) / 60000;
    return age > LIMITS[t.priority] && t.status !== "closed";
  }).length;

  res.json({
    success: true,
    statusStats,
    priorityStats,
    slaBreachedCount: breachedCount
  });
});