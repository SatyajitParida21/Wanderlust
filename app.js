if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const PORT = process.env.PORT || 8080;
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const engine = require("ejs-mate");
const ExpressError = require("./utils/ExpressError.js");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const flash = require("connect-flash");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");

const listingRouter = require("./routes/listing.js");
const reviewRouter = require("./routes/review.js");
const userRouter = require("./routes/user.js");

// ----------------- MONGODB CONNECTION -----------------
const dbURL = process.env.ATLASDB_URL;
mongoose.connect(dbURL)
  .then(() => console.log("Connected to MongoDB"))
  .catch(err => console.log("MongoDB connection error:", err));

// ----------------- TEMPLATE ENGINE -----------------
app.engine("ejs", engine);
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ----------------- MIDDLEWARE -----------------
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.use(express.static(path.join(__dirname, "/public")));
app.use(flash());

// ----------------- SESSION -----------------
const store = MongoStore.create({
  mongoUrl: dbURL,
  crypto: { secret: process.env.SECRET || "thisshouldbesecret!" },
  touchAfter: 24 * 3600,
});

store.on("error", err => {
  console.log("MONGO SESSION STORE ERROR:", err);
});

app.use(session({
  store,
  secret: process.env.SECRET || "thisshouldbesecret!",
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: true,
    expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

// ----------------- PASSPORT -----------------
app.use(passport.initialize());
app.use(passport.session());
passport.use(new LocalStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

// ----------------- FLASH & CURRENT USER -----------------
app.use((req, res, next) => {
  res.locals.success = req.flash("success") || [];
  res.locals.error = req.flash("error") || [];
  res.locals.currUser = req.user || null;
  next();
});

// ----------------- ROUTES -----------------
app.use("/listings", listingRouter);
app.use("/listings/:id/reviews", reviewRouter);
app.use("/", userRouter);

app.get("/", (req, res) => {
  res.redirect("/listings");
});

// ----------------- 404 HANDLER -----------------
app.all("*", (req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

// ----------------- ERROR HANDLER -----------------
app.use((err, req, res, next) => {
  const { statusCode = 500, message = "Something went wrong!" } = err;
  res.status(statusCode).render("error.ejs", { err });
});

// ----------------- START SERVER -----------------
app.listen(PORT, () => {
  console.log(`App is listening on port ${PORT}`);
});
