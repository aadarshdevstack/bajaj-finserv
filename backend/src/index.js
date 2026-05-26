import 'dotenv/config';
import connectDB from "./db/index.js";
import dns from "dns"
import { app } from "./app.js";

dns.setServers(["1.1.1.1" , "8.8.8.8"])

connectDB()
.then(
    () => {
        app.listen(process.env.PORT || 8000 , () => {
            console.log(`server is connected at PORT:${process.env.PORT}`);
            
        })
    }
)
.catch(
    (error) => {
        console.log(`mongoDB connection failed` , error);
        
    }
)