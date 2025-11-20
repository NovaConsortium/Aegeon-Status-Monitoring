# Validator Balance Tracking Implementation

## Changes Made

### 1. Database Schema Updates
- **File**: `schema/trackedMainnetValidator.js`
- **Change**: Updated `lastBalanceNotification` to be an object mapping userId -> boolean
- **Purpose**: Track notification state per user instead of globally

- **File**: `schema/userData.js`
- **Change**: Added `balanceThreshold` field (default: 3 SOL, min: 0.1, max: 100)
- **Purpose**: Store user-specific balance thresholds

### 2. Enhanced Balance Tracker Handler
- **File**: `handler/validatorBalanceTracker.js`
- **Functionality**: 
  - Checks SOL balance for all tracked mainnet validators
  - Uses user-specific thresholds instead of hardcoded 3 SOL
  - Sends notifications when balance drops below user's threshold
  - Sends "resolved" notifications when balance recovers above user's threshold
  - Handles multiple users with different thresholds for same validator
  - Uses database state to prevent duplicate notifications per user

### 3. New Discord Command
- **File**: `commands/set-balance-threshold.js`
- **Functionality**: 
  - Allows users to set their balance threshold (0.1 - 100 SOL)
  - Validates threshold values
  - Updates user data in database

### 4. Enhanced Telegram Bot
- **File**: `telegram/index.js`
- **Changes**: 
  - Added "Set Balance Threshold" button to main menu
  - Added threshold input handling
  - Validates threshold values (0.1 - 100 SOL)
  - Updates user data in database

### 5. Integration with Main Application
- **File**: `index.js`
- **Changes**: 
  - Added import for `trackValidatorBalances` function
  - Added 10-minute interval to call balance tracker
  - Uses existing mainnet connection

## Key Features
- **User-Specific Thresholds**: Each user can set their own balance threshold
- **Default Threshold**: 3 SOL (if user hasn't set custom threshold)
- **Threshold Limits**: 0.1 SOL minimum, 100 SOL maximum
- **Network**: Mainnet only
- **Frequency**: Every 10 minutes
- **Notifications**: Same system as existing validators (Discord DM + Telegram)
- **Multi-User Support**: Multiple users can track same validator with different thresholds
- **Spam Prevention**: Database state tracking prevents duplicate notifications per user
- **Recovery Notifications**: Sends "resolved" message when balance recovers above threshold

## User Commands
### Discord
- `/set-balance-threshold <threshold>` - Set balance threshold for notifications

### Telegram
- Use "⚙️ Set Balance Threshold" button in main menu
- Send threshold value when prompted (0.1 - 100 SOL)

### 6. Enhanced Message Formatting System
- **File**: `handler/messageFormatter.js`
- **Functionality**: 
  - Centralized message formatting for Discord and Telegram
  - Rich Discord embeds with colors, fields, and timestamps
  - Clean Telegram text formatting with markdown
  - Easy customization of messages for different platforms
  - Technical and detailed message content
  - Solscan links to validators
  - Unix timestamp formatting for Discord

- **File**: `handler/notificationUtils.js`
- **Changes**: 
  - Updated to use new message formatting system
  - Separate Discord embed and Telegram text formatting
  - Enhanced message data handling

- **File**: `handler/validatorBalanceTracker.js`
- **Changes**: 
  - Updated to use new message formatting system
  - Improved notification data structure
  - Better separation of Discord and Telegram notifications

- **File**: `index.js`
- **Changes**: 
  - Updated voting status notifications to use new formatting
  - Enhanced message data for status changes

## Key Features
- **User-Specific Thresholds**: Each user can set their own balance threshold
- **Default Threshold**: 3 SOL (if user hasn't set custom threshold)
- **Threshold Limits**: 0.1 SOL minimum, 100 SOL maximum
- **Network**: Mainnet only
- **Frequency**: Every 10 minutes
- **Notifications**: Same system as existing validators (Discord DM + Telegram)
- **Multi-User Support**: Multiple users can track same validator with different thresholds
- **Spam Prevention**: Database state tracking prevents duplicate notifications per user
- **Recovery Notifications**: Sends "resolved" message when balance recovers above threshold
- **Enhanced Formatting**: Rich Discord embeds and clean Telegram text
- **Technical Details**: Detailed messages with Solscan links and timestamps

## User Commands
### Discord
- `/set-balance-threshold <threshold>` - Set balance threshold for notifications

### Telegram
- Use "⚙️ Set Balance Threshold" button in main menu
- Send threshold value when prompted (0.1 - 100 SOL)

## Security Considerations
- No sensitive data exposed in logs
- Uses existing notification system (no new attack vectors)
- Database updates are atomic and safe
- Error handling prevents crashes
- No hardcoded credentials or API keys
- Input validation on all threshold values
- Proper error handling for invalid inputs
- Enhanced message formatting with secure data handling
