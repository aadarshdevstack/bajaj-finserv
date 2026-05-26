import {Router} from "express"
import { createTicket, deleteTicket, getStats, getTickets, updateTicket } from "../controllers/ticket.controller.js"

const router = Router()


router.route("/").post(createTicket)
router.route("/").get(getTickets)
router.route("/:id").patch(updateTicket)
router.route("/:id").delete(deleteTicket)
router.route("/stats").get(getStats)




export default router