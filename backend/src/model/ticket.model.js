import mongoose from "mongoose";

const ticketSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true,
    match: /.+\@.+\..+/
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    required: true
  },
  status: {
    type: String,
    enum: ["open", "in_progress", "resolved", "closed"],
    default: "open"
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  resolvedAt: {
    type: Date,
    default: null
  }
});

export const Ticket = mongoose.model("Ticket", ticketSchema);