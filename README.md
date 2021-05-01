## An additional plugin for [Dark's ReactionThreads](https://github.com/MMPlugins/ReactionThreads) plugin that creates a menu of reaction in private channels

## Setup
This plugin requires [Dark's ReactionThreads](https://github.com/MMPlugins/ReactionThreads) to function and must be installed first
After adding `ReactionThreads`, in your config.ini file, add:
```
plugins[] = npm:YetAnotherConnor/ReactionThreadsMenu
extraIntents[] = directMessageReactions
```
and after you restart your bot, messages sent to the bot directly will have the same menu of ractions used in `ReactionThreads`!

## Useage
### Extra Configuration
`reactionThreads-resopnseMessage` the menu message header
- Defaults to "If you could select one of the following reactions that best fits your message, that would help us out a lot!"

`reactionThreads-menu` allows users to send the menu command and recieve a new menu
- Defaults to true, but adding `reactionThreads-menu = false` in your config disables this

`reactionThreads-oldMenus` menus created in prior closed threads can create a new thread
- Defaults to true, but adding `reactionThreads-menu = false` in your config disables this

### Information
This plugin requires the `ReactionThreadsMenuData.json` file which is created on first launch; moving or deleting this file will lose necessary data.

If you run multiple instances of the bot from the same folder, the same `reactionThreads-suffix` in your config.ini file used for [ReactionThreads](https://github.com/MMPlugins/ReactionThreads) will be applied for this plugin as well

## Commands
### Adding a Reaction Description
Useage: `!rtDescription <ChannelID> <MessageID> <Emoji> [Description]`

- `ChannelID` has to be the ID of the channel the message the reaction should be added to is in.
- `MessageID` is the ID of the message in that channel.
- `Emoji` is just the emoji directly from the emoji picker without any changes.
- `Description` is description to be shown in a menu for that reaction

If the description parameter *is not* passed, the bot will display the currently set custom description.
If the description parameter *is* passed, the bot will set the reaction to use this new description.

### Sending a New Menu
Useage: `!menu`

This command will create a new menu for the user
If `reactionThreads-menu` is set to false, only staff are able to create a new menu, otherwise both user and staff are able to use this command

### Checking and Validating Menu Appearence
Useage: `!menutest`

The bot will show how the menu appears to the user and what each response is, which can only be used in the inbox server
