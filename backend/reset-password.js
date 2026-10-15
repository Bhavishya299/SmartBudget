const bcrypt = require('bcrypt');
require('dotenv').config();

const { sequelize, User } = require('./models');

const reset = async () => {
  try {
    await sequelize.authenticate();
    console.log("Connected to DB");

    const emailToReset = "sumitworkspace2024@gmail.com";
    const user = await User.findOne({ where: { email: emailToReset.trim().toLowerCase() } });

    if (!user) {
      console.log("User not found!");
      process.exit(1);
    }

    user.password = await bcrypt.hash("123456", 10);
    await user.save();

    console.log("Password reset successfully to: 123456");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

reset();
