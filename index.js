require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const session = require("express-session");

app.use(session({
  secret: "your-secret-key",  // Change this to a secure secret key
  resave: false,
  saveUninitialized: true
}));


const methodOverride = require("method-override");
app.use(methodOverride("_method"));
app.use(express.urlencoded({extended : true}));

const path = require("path");
app.set("view engine", "ejs"); //for adding templates
app.set("views", path.join(__dirname, "/views"));

app.use(express.static(path.join(__dirname, 'public')));

const mysql = require('mysql2');
const connection = mysql.createConnection({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD
});

//Home route
app.get("/", (req,res) => {  //HOME ROUTE : to fetch the home page
    try{
      res.render("home.ejs");
    }catch (err) {
        console.log(err);
        res.send("some error in loading website");
    }
});

//userLogin route
app.get("/userLogin", (req, res) => {
  res.render("userLogin.ejs");
});


//Contact Us route
app.get("/contactUs", (req, res) => {
  res.render("contactUs.ejs");
});


// user Requirement page for user (in login)
app.get("/userRequirement", (req, res) => {
  // Check if user is logged in
  if (!req.session.userEmail) {
      return res.redirect("/userLogin"); // Redirect to login if not logged in
  }
  // Render the userRequirement.ejs page
  res.render("userRequirement.ejs", { userEmail: req.session.userEmail });
});

// User Dashboard Page
app.get("/userDashboard", (req, res) => {
  // Check if user is logged in
  if (!req.session.userEmail) {
      return res.redirect("/userLogin"); // Redirect to login if not logged in
  }

  const user_email = req.session.userEmail; // Get the user's email

  // SQL query to get the user's requests from the contact_requests table
  const query = `
      SELECT maid_name, request_date, status, maid_phone 
      FROM contact_requests 
      WHERE user_email = ?`;

  connection.query(query, [user_email], (err, results) => {
      if (err) {
          console.error("Error fetching user requests:", err.message);
          return res.status(500).send("Error fetching requests");
      }

      // Map the results to include the necessary data
      const requestsSent = results.map(request => ({
          name: request.maid_name,
          date: request.request_date, // Adjust according to your column names
          status: request.status,
          phone: request.maid_phone
      }));

      res.render("userDashboard.ejs", { userEmail: user_email, requestsSent });
  });
});

// User Login POST Route (to handle the login form submission)
app.post("/userDashboard", (req, res) => {
  const { email, password } = req.body;

  // Query to check the credentials
  const query = `SELECT * FROM users WHERE email = ? AND password = ?`;

  connection.query(query, [email, password], (err, results) => {
      if (err) {
          console.error("Error querying MySQL:", err.message);
          return res.status(500).send("Error querying database");
      }

      // Check if credentials are valid
      if (results.length > 0) {
          console.log("Login successful:", results);

          // Store user email in session
          req.session.userEmail = email;

          // Redirect to user dashboard
          res.redirect("/userDashboard");
      } else {
          console.log("Invalid email or password");
          res.status(401).send("Invalid email or password");
      }
  });
});
 
// Route to handle contacting a maid
app.post("/contactMaid", (req, res) => {
  // Check if user is logged in
  if (!req.session.userEmail) {
      return res.status(401).send("Unauthorized: Please log in.");
  }

  const { name, gender, experience, address } = req.body;
  const user_email = req.session.userEmail; // Get the user's email from the session

  // SQL query to get the maid_id and maid_phone based on maid_name
  const getMaidIdAndPhoneQuery = "SELECT maid_id, maid_phone FROM maids WHERE maid_name = ?";
  
  connection.query(getMaidIdAndPhoneQuery, [name], (err, results) => {
    if (err) {
        console.error("Error fetching maid information from database:", err.message);
        return res.status(500).send("Error fetching maid information");
    }

      // If no maid is found with the given name
      if (results.length === 0) {
        return res.status(404).send("Maid not found");
    }

    const maid_id = results[0].maid_id; // Get the maid_id
    const maid_phone = results[0].maid_phone; // Get the maid's phone number


      // SQL query to insert the contact request into the database
      const insertQuery = `INSERT INTO contact_requests (user_email, maid_name, maid_id, maid_phone) VALUES (?, ?, ?, ?)`;


      connection.query(insertQuery, [user_email, name, maid_id, maid_phone], (err, results) => {
        if (err) {
            console.error("Error inserting contact request into database:", err.message);
            return res.status(500).send("Error saving contact request");
        }


          console.log("Contact request successfully saved:", results);

          // Create a request object
          const request = {
              name,
              date: new Date().toISOString().split('T')[0],  // Just the date part
              status: "Pending"
          };

          // Initialize requestsSent in the session if it doesn't exist
          if (!req.session.requestsSent) {
              req.session.requestsSent = [];
          }

          // Add the request to the session
          req.session.requestsSent.push(request);

          // Redirect to the user dashboard
          res.redirect("/userDashboard");
      });
  });
});


// User Details Add Route
app.patch("/UserDetailsAdd", (req, res) => {
  console.log("Updating user details...");
  console.log("Received request body:", req.body);

  const { email, name, phone_no, gender, address, aadhaar_no } = req.body;

  if (!email) {
    console.log("Error: Email is missing in the request.");
    return res.status(400).send("Email is required");
  }

  const query = `UPDATE users SET name = ?, phone_no = ?, gender = ?, address = ?, aadhaar_no = ? WHERE email = ?`;

  connection.query(query, [name, phone_no, gender, address, aadhaar_no, email], (err, results) => {
    if (err) {
      console.error("Error updating user details:", err.message);
      return res.status(500).send("Error updating user details");
    }

    if (results.affectedRows > 0) {
      console.log("User details successfully updated:", results);
      res.render("userLogin.ejs");
    } else {
      console.log("No user found with the given email.");
      res.status(404).send("User not found");
    }
  });
});

//register route
app.get("/userLogin/register", (req,res) => {    
  res.render("userRegister.ejs");
});

//user Add route
app.post("/userLogin/register", (req, res) => {
  const { email, password } = req.body;

  const query = `INSERT INTO users (email, password) VALUES (?, ?)`;

  connection.query(query, [email, password], (err, results) => {
    if (err) {
      console.error("Error inserting data into MySQL:", err.message);
      return res.status(500).send("Error saving data");
    }

    console.log("User successfully registered:", results);

    // Store user email in session
    req.session.userEmail = email;

    // Redirect to /userDetails route
    res.redirect("/userDetails");
  });
});

// User details route
app.get("/userDetails", (req, res) => {
  const userEmail = req.session.userEmail || "default@example.com"; // Use session data
  res.render("userDetails.ejs", { userEmail });
});


//AdminLogin route
app.get("/AdminLogin", (req, res) => {
  res.render("AdminLogin.ejs");
});

//Admin Login is correct? 
app.post("/AdminLoginCheck", (req, res) => {
  const { admin_id, admin_pass } = req.body;
  const query = `SELECT * FROM admin WHERE admin_id = ? AND admin_pass = ?`;

  connection.query(query, [admin_id, admin_pass], (err, results) => {
      if (err) {
          console.error("Error querying admin table:", err.message);
          return res.status(500).send("Internal server error");
      }

      if (results.length > 0) {
          console.log("Admin login successful:", results);

          //Store admin session
          req.session.adminId = admin_id;
          res.redirect("/adminDashboard");

      } else {
          console.log("Invalid Admin ID or Password");
          res.status(401).send("Invalid Admin ID or Password");
      }
  });
});

//Admin Dashboard
app.get("/adminDashboard", (req, res) => {
  if (!req.session.adminId) {
      return res.status(403).send("Unauthorized Access. Please login.");
  }

  const query = `SELECT * FROM maids`;

  connection.query(query, (err, results) => {
      if (err) {
          console.error("Error fetching maids:", err.message);
          return res.status(500).send("Error retrieving maid data");
      }

      res.render("adminDashboard.ejs", { 
          adminId: req.session.adminId,  
          maids: results  // Sending the maid data to the template
      });
  });
});

//Admin Request Inbox
app.get("/adminDashboard/requestInbox", (req, res) => {
  if (!req.session.adminId) {
      return res.status(403).send("Unauthorized Access. Please login.");
  }

  const query = `
      SELECT m.*, 
             cr.user_email, 
             cr.status 
      FROM maids AS m 
      LEFT JOIN contact_requests AS cr ON m.maid_name = cr.maid_name 
      WHERE cr.status = 'Pending'`;

  connection.query(query, (err, results) => {
      if (err) {
          console.error("Error fetching maids and requests:", err.message);
          return res.status(500).send("Error retrieving maid data");
      }

      // Group maids by requests
      const maidsWithRequests = results.reduce((acc, row) => {
          const maid = acc.find(m => m.maid_id === row.maid_id);
          if (!maid) {
              acc.push({
                  maid_id: row.maid_id,
                  maid_name: row.maid_name,
                  maid_phone: row.maid_phone,
                  maid_gender: row.maid_gender,
                  maid_address: row.maid_address,
                  requests: [{
                      user_email: row.user_email,
                      status: row.status,
                  }]
              });
          } else {
              maid.requests.push({
                  user_email: row.user_email,
                  status: row.status
              });
          }
          return acc;
      }, []);

      res.render("adminRequestInbox.ejs", { 
          adminId: req.session.adminId,  
          maids: maidsWithRequests  // Sending the maid data to the template
      });
  });
});

//new maid
app.get("/adminDashboard/newMaid", (req, res) => {
  res.render("maidDetailsOne.ejs");
});

//add new maid
app.post("/adminDashboard/addMaid", (req, res) => {
  const { maid_name, maid_phone, maid_gender, maid_address, maid_aadhaar } = req.body;

  const checkQuery = `SELECT * FROM maids WHERE maid_phone = ?`;
  connection.query(checkQuery, [maid_phone], (err, results) => {
    if (err) {
      console.error("Error checking maid phone:", err);
      return res.status(500).send("Database error");
    }

    if (results.length > 0) {
      return res.status(400).send("Maid with this phone number already exists. Try another number.");
    }

    const insertQuery = `
      INSERT INTO maids (maid_name, maid_phone, maid_gender, maid_address, maid_aadhaar) 
      VALUES (?, ?, ?, ?, ?)`;

    connection.query(insertQuery, [maid_name, maid_phone, maid_gender, maid_address, maid_aadhaar], (err, result) => {
      if (err) {
        console.error("Error inserting maid:", err);
        return res.status(500).send("Error registering maid");
      }

      //Fetch the newly inserted maid's ID
      const maid_id = result.insertId; 

      //Pass maid_id to maidDetailsTwo.ejs
      res.render("maidDetailsTwo.ejs", { maid_id });
    });
  });
});

//add new maid MORE INFORMATION 
app.post("/adminDashboard/addMaid/info", (req, res) => {
  const { maid_id, working_hrs, working_time, salary_expected, experience, maid_work } = req.body;

  if (!maid_id) {
      return res.status(400).send("Maid ID is missing");
  }

  const query = `
      UPDATE maids 
      SET working_hrs = ?, working_time = ?, salary_expected = ?, experience = ?, maid_work = ? 
      WHERE maid_id = ?`;

  connection.query(query, [working_hrs, working_time, salary_expected, experience, maid_work, maid_id], (err, result) => {
      if (err) {
          console.error("Error updating maid details:", err);
          return res.status(500).send("Error updating maid details");
      }

      if (result.affectedRows > 0) {
          res.redirect("/adminDashboard");
      } else {
          res.status(404).send("Maid not found");
      }
  });
});


// Searching maids according to filter by user
app.post("/searchingMaids", (req, res) => {
  const { maid_work, working_time, salary_expected } = req.body;

  // Check if all required fields are provided
  if (!maid_work || !working_time || !salary_expected) {
    return res.status(400).send("All fields are required");
  }

  // Construct the SQL query to find eligible maids
  const query = `
    SELECT * FROM maids 
    WHERE maid_work = ? 
      AND working_time = ? 
      AND salary_expected <= ?`; // Assuming salary_expected is a maximum threshold

  connection.query(query, [maid_work, working_time, salary_expected], (err, results) => {
    if (err) {
      console.error("Error querying maids:", err.message);
      return res.status(500).send("Error retrieving maid data");
    }

    // Check if any maids were found
    if (results.length > 0) {
      console.log("Eligible maids found:", results);
      // Render a page with the list of maids (you may need to create this view)
      res.render("eligibleMaids.ejs", { maids: results });
    } else {
      console.log("No eligible maids found");
      // res.status(404).send("No eligible maids found");
      res.render("NoEligible.ejs");
    }
  });
});

// Accept or decline requests from admin
app.post("/admin/acceptRequest", (req, res) => {
  const { maid_id, user_email, action } = req.body;

  console.log(`Action: ${action}, Maid ID: ${maid_id}, User Email: ${user_email}`);

  if (action === "accept") {
      // Update the request status to 'Accepted' based on maid_id and user_email
      const updateQuery = `
          UPDATE contact_requests 
          SET status = 'Accepted' 
          WHERE maid_id = ? 
          AND user_email = ?`;

      connection.query(updateQuery, [maid_id, user_email], (err, results) => {
          if (err) {
              console.error("Error updating request status:", err.message);
              return res.status(500).send("Error updating request status");
          }

          console.log("Update Results:", results); // Log the results
          if (results.affectedRows > 0) {
              res.redirect("/adminDashboard");
          } else {
              res.status(404).send("Request not found or already updated.");
          }
      });

  } else if (action === "decline") {
      // Update the request status to 'Declined' based on maid_id and user_email
      const updateQuery = `
          UPDATE contact_requests 
          SET status = 'Declined' 
          WHERE maid_id = ? 
          AND user_email = ?`;

      connection.query(updateQuery, [maid_id, user_email], (err, results) => {
          if (err) {
              console.error("Error updating request status:", err.message);
              return res.status(500).send("Error updating request status");
          }

          console.log("Update Results:", results); // Log the results
          if (results.affectedRows > 0) {
              res.redirect("/adminDashboard");
          } else {
              res.status(404).send("Request not found or already updated.");
          }
      });

  } else {
      return res.status(400).send("Invalid action");
  }
});



app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});

