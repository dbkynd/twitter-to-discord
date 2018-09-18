const mongoose = require('mongoose');

const channels = new mongoose.Schema({
  screen_name: String,
  twitter_id: String,
  channels: [{
    guild_id: String,
    channel_id: String,
  }],
});

module.exports = mongoose.model('channels', channels);
