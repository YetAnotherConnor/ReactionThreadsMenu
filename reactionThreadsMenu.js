module.exports = function ({ bot, config, commands, hooks, knex, threads }) {
  const fs = require("fs");
  const Eris = require("eris");
  const erisEndpoints = require("eris/lib/rest/Endpoints");
  const pluginVersion = "1.1";
  const changelogUrl = "https://github.com/YetAnotherConnor/ReactionThreadsMenu/blob/main/CHANGELOG.md";
  let rtReactions = [];
  let reactions = [];

  // Load the suffix for the json file, if one exists (used for multiple bot instances running from the same folder)
  const jsonSuffix = config["reactionThreads-suffix"] ? config["reactionThreads-suffix"] : "";

  // If there is no json file for the parent plugin, break out of this plugin
  if (!fs.existsSync(`./ReactionThreadsData${jsonSuffix}.json`)) {
    console.info(
      `[ReactionThreads-Menu] A ReactionThreadsData${jsonSuffix}.json file was not found. Please make sure you have added the ReactionThreads plugin => https://github.com/MMPlugins/ReactionThreads <= and/or restart the bot`,
    );
  } else {
    // Warn the user not to delete the file in case it doesn't exist (basically a first-use check)
    if (!fs.existsSync(`./ReactionThreadsMenuData${jsonSuffix}.json`)) {
      console.info(
        `[ReactionThreads-Menu] A ReactionThreadsMenuData${jsonSuffix}.json file will be created when using this plugin. Please do not modify or delete this file or reactions you set up will cease to function.`,
      );
    } else {
      // Load registered reactions if the file exists
      const data = fs.readFileSync(`./ReactionThreadsMenuData${jsonSuffix}.json`);
      reactions = JSON.parse(data);
    }

    //#region filesystem
    /**
     * Stores all registered reactions into the data file for persistence
     */
    const saveReactions = function () {
      fs.writeFileSync(`./ReactionThreadsMenuData${jsonSuffix}.json`, JSON.stringify(reactions));
    };

    /**
     * Update menu file whenever a change is done to the parent file
     */
    fs.watch(`./ReactionThreadsData${jsonSuffix}.json`, (eventType, filename) => {
      updateReactions();
    })

    function updateReactions() {
      const rtData = fs.readFileSync(`./ReactionThreadsData${jsonSuffix}.json`);
      rtReactions = JSON.parse(rtData);

      // For all reactions in parent file, add or update in menu file
      for (const rtreact of rtReactions) {
        if (rtreact.channelId === "version") continue;
        let needsReaction = true;
        for (react of reactions) {
          if (rtreact.channelId == react.channelId && rtreact.messageId == react.messageId && rtreact.emoji == react.emoji) {
            needsReaction = false;
            react.response = rtreact.response;
            saveReactions();
          }
        }
        if (needsReaction) {
          reactions.push({
            channelId: rtreact.channelId,
            messageId: rtreact.messageId,
            emoji: rtreact.emoji,
            categoryId: rtreact.categoryId,
            pingRoleId: rtreact.pingRoleId,
            response: rtreact.response ? rtreact.response : null
          })
          saveReactions();
        }
      }

      // Remove reactions not found in parent file from menu file
      for (react of reactions) {
        if (react.channelId === "version") continue;
        needsRemoving = true;
        for (const rtreact of rtReactions) {
          if (rtreact.channelId == react.channelId && rtreact.messageId == react.messageId && rtreact.emoji == react.emoji) {
            needsRemoving = false;
          }
        }
        if (needsRemoving) {
          reactions.splice(reactions.indexOf(react), 1);
          saveReactions();
        }
      }
    }
    updateReactions();
    //#endregion filesystem

    //#region funtions
    /**
     * Checks whether userId is blocked
     * @param {String} userId
     * @returns {Promise<Boolean>}
     */
    async function isBlocked(userId) {
      const row = await knex("blocked_users")
        .where("user_id", userId)
        .first();
      return !!row;
    }

    /**
     * Checks whether or not the user invoking a command is authorized or not
     * @param {*} message the message to check permissions for
     */
    const isOwner = function (message) {
      if (typeof ownerId === "undefined") return true;
      return message.member.id === ownerId ? true : message.member.roles.includes(ownerId);
    };

    /**
     * Checks whether or not passed parameters are a valid reaction
     * @param {string} channelId The ID of the channel for which to check
     * @param {string} messageId The ID of the message for which to check
     * @param {string} emoji The stringified emoji for which to check (i.e. <:test:108552944961454080>)
     * @returns full reaction if valid, null if not
     */
    const isValidReaction = function (channelId, messageId, emoji) {
      for (const reaction of reactions) {
        if (reaction.channelId == channelId && reaction.messageId == messageId && reaction.emoji == emoji) {
          return reaction;
        }
      }
      return null;
    };

    /**
     * Send users that started a thread through dm a new menu
     * @param {Object} beforeNewThreadData The data provided before opening a new thread
     */
    const sendNewMenu = async function (beforeNewThreadData) {
      // message is undefined for reactions to parent reactionThreads or past menus
      if (typeof beforeNewThreadData.message === "undefined") return;
      try {
        createMenu(beforeNewThreadData.message.channel.id);
      } catch (e) {
        console.error(`[ReactionThreads] Could not send auto-response to user: ${e}`);
      }
    }

    hooks.beforeNewThread(sendNewMenu);

    /**
     * Formats reactions to prevent duplicate options in menu
     * This assumes reactions with same emoji (different messages) link to same category, default first
     * @returns formatted reactions
     */
    function reactionList() {
      let reactionResult = [];
      for (const reaction of reactions) {
        let duplicate = false;
        for (const react of reactionResult) {
          if (react.emoji === reaction.emoji) {
            duplicate = true;
            break;
          }
        }
        if (!duplicate) reactionResult.push(reaction);
      }
      return reactionResult;
    }

    /**
     * Create menu for user in given channel
     * @param {string} channelId 
     */
    async function createMenu(channelId, thread = null, testLength = false) {
      let responseMessage = config["reactionThreads-responseMessage"] ? config["reactionThreads-responseMessage"] :
        "If you could select one of the following reactions that best fits your message, that would help us out a lot!";
      const formReactions = reactionList();
      for (const reaction of formReactions) {
        if (reaction.channelId === "version") continue;
        responseMessage += `\n${reaction.emoji} - ${reaction.description ? reaction.description : "Start a new thread"}`;
      }
      if (testLength) return responseMessage.length;
      bot.createMessage(channelId, responseMessage).then(newMessage => {
        for (const reaction of formReactions) {
          if (reaction.channelId === "version") continue;
          bot.addMessageReaction(newMessage.channel.id, newMessage.id, reaction.emoji.replace(">", "")).catch(e => { });
        }
        if (thread) {
          thread.postSystemMessage(":gear: **ReactionThreads:** menu sent to user!");
        }
        return;
      }).catch(e => {
        if (thread) {
          return thread.postSystemMessage("⚠️ Could not send menu to the user. They may have blocked the bot or set their privacy settings higher.");
        }
      });
    }

    /**
     * Handles any reaction added within a private channel. If it is a registered reaction, move thread to proper category
     * @param {Message} message The message that got reacted to
     * @param {Emoji} emoji The emoji used to react
     * @param {Member} reactor The memeber object of the person reacting
     */
    const onPrivReactionAdd = async (message, emoji, reactor) => {
      if (reactor.id === bot.user.id) return;
      const msg = await bot.getMessage(message.channel.id, message.id);
      if (!(msg.author.bot)) return;
      const msgChannel = await bot.getRESTChannel(msg.channel.id)
      if (!(msgChannel instanceof Eris.PrivateChannel)) return;

      const stringifiedEmoji = emoji.id ? `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>` : emoji.name;
      let reaction = null;
      for (const react of reactions) {
        if (react.emoji == stringifiedEmoji) {
          reaction = react;
        }
      }
      if (reaction != null) {
        bot.deleteMessage(message.channel.id, message.id);
        if (await isBlocked(reactor.id)) return;
        const userThread = await threads.findOpenThreadByUserId(reactor.id);
        if (userThread) {
          const oldChannel = bot.getChannel(userThread.channel_id);
          const postToThreadChannel = config.showResponseMessageInThreadChannel;
          let responseMessage = Array.isArray(config.responseMessage)
            ? config.responseMessage.join("\n")
            : config.responseMessage;
          responseMessage = responseMessage == "" ? "Thank you for your message! Our mod team will reply to you here as soon as possible." : responseMessage;
          userThread
            .sendSystemMessageToUser(`${reaction.response ? reaction.response : responseMessage
              }${config["reactionThreads-menu"] == false ? `` : ` (You can change your selection by sending \`` + config.prefix + `menu\`)`}`,
              { postToThreadChannel })
            .catch((e) => {
              // Ideally this will be fixed upstream at some point
              userThread.postSystemMessage(
                "⚠️ **ReactionThreads:** Could not open DMs with the user. They may have blocked the bot or set their privacy settings higher.",
              );
            });
          if (oldChannel.parentID == reaction.categoryId) {
            userThread.postSystemMessage(`:gear: **ReactionThreads:** User reacted with ${reaction.emoji} thread does not need to move!`);
          } else {
            await bot.editChannel(userThread.channel_id, { parentID: reaction.categoryId })
              .catch(e => {
                userThread.postSystemMessage(`Failed to move thread: ${e.message}`);
                return;
              });
            // If enabled, sync thread channel permissions with the category it's moved to
            if (config.syncPermissionsOnMove) {
              const targetCategory = bot.getChannel(reaction.categoryId);
              const newPerms = Array.from(targetCategory.permissionOverwrites.map(ow => {
                return {
                  id: ow.id,
                  type: ow.type,
                  allow: ow.allow,
                  deny: ow.deny
                };
              }));

              try {
                await bot.requestHandler.request("PATCH", erisEndpoints.CHANNEL(userThread.channel_id), true, {
                  permission_overwrites: newPerms
                });
              } catch (e) {
                userThread.postSystemMessage(`Thread moved to ${targetCategory.name.toUpperCase()}, but failed to sync permissions: ${e.message}`);
                return;
              }
            }
            const toPing = reaction.pingRoleId != null ? reaction.pingRoleId : null;
            userThread.postSystemMessage(`:gear: **ReactionThreads:** Thread moved because of reaction ${reaction.emoji}${toPing != null ? " <@&" + toPing + ">" : ""}`,
              { allowedMentions: { roles: [toPing] } },
            );
          }
        } else if (config["reactionThreads-oldMenus"] != false) {
          const user = await bot.getRESTUser(reactor.id);
          const newThread = await threads.createNewThreadForUser(user, {
            source: "dm_reaction",
            categoryId: reaction.categoryId,
          });

          const toPing = reaction.pingRoleId != null ? reaction.pingRoleId : null;
          let responseMessage = Array.isArray(config.responseMessage)
            ? config.responseMessage.join("\n")
            : config.responseMessage;
          responseMessage = responseMessage == "" ? "Thank you for your message! Our mod team will reply to you here as soon as possible." : responseMessage;
          const postToThreadChannel = config.showResponseMessageInThreadChannel;
          await newThread.postSystemMessage(
            `:gear: **ReactionThreads:** Thread opened because of reaction ${stringifiedEmoji
            } in dms${toPing != null ? " <@&" + toPing + ">" : ""}`,
            { allowedMentions: { roles: [toPing] } },
          );
          newThread
            .sendSystemMessageToUser(`${reaction.response ? reaction.response : responseMessage
              }${config["reactionThreads-menu"] == false ? `` : ` (You can change your selection by sending \`` + config.prefix + `menu\`)`}`,
              { postToThreadChannel })
            .catch((e) => {
              // Ideally this will be fixed upstream at some point
              newThread.postSystemMessage(
                "⚠️ **ReactionThreads:** Could not open DMs with the user. They may have blocked the bot or set their privacy settings higher.",
              );
            });
        }
      }
    }
    //#endregion funtions

    //#region commands
    /**
     * Registers or updates a reaction description
     * @param {Message} message The message invoking the command
     * @param {*} args The arguments passed (check registering at bottom)
     */
    const ReactionDescCmd = async (message, args) => {
      if (!isOwner(message)) return;
      reaction = isValidReaction(args.channelId, args.messageId, args.emoji);
      if (reaction == null) {
        message.channel.createMessage(`⚠️ Unable to add reaction description: That reaction doesn't exist on that message!`);
        return;
      }

      if (args.description) {
        const description = args.description.trim();
        menuMsgLength = await createMenu(null, null, true);
        if ((menuMsgLength + description.length + 20) > 2000) {
          message.channel.createMessage("⚠️ That custom description is too long! Consider shortening other descriptions");
          return;
        }

        reaction.description = description;
        saveReactions();
        message.channel.createMessage("Successfully created/updated reaction description and registered it internally.");
      } else {
        message.channel.createMessage(
          `The current description for that reaction is: \`${reaction.description ? reaction.description : "Start a new thread"}\``,
        );
      }
    };

    /**
     * Create new menu for user
     * @param {Message} message The message invoking the command
     * @param {*} args The arguments passed (check registering at bottom)
     */
    const menuCmd = async (message, args) => {
      const userThread = await threads.findOpenThreadByUserId(message.author.id);
      const mailThread = await threads.findOpenThreadByChannelId(message.channel.id);
      if (message.channel instanceof Eris.PrivateChannel && userThread) {
        if (config["reactionThreads-menu"] == false) return;
        createMenu(message.channel.id, userThread);
      } else if (mailThread) {
        const content = await knex("thread_messages").where({ thread_id: mailThread.id }).first("dm_channel_id");
        createMenu(content.dm_channel_id, mailThread);
      }
    }

    const menuTestCmd = async (message, args) => {
      createMenu(message.channel.id);
      let responseMessage = Array.isArray(config.responseMessage)
        ? config.responseMessage.join("\n")
        : config.responseMessage;
      responseMessage = responseMessage == "" ? "Thank you for your message! Our mod team will reply to you here as soon as possible." : responseMessage;
      let responseList = [];
      const reacts = reactionList();
      for (react of reacts) {
        if (react.channelId === "version") continue;
        responseList.push(`${react.emoji} - ${react.response ? react.response : responseMessage}`);
      }
      let responses = [`\`emote - response\``]
      for (const responseItem of responseList) {
        if (responses[responses.length - 1].length + responseItem.length > 2000) {
          responses.push(responseItem);
        } else {
          responses[responses.length - 1] += `\n${responseItem}`;
        }
      }
      for (const response of responses) {
        bot.createMessage(message.channel.id, response);
      }
    }
    //#endregion commands

    //#region versioncheck
    // Check the plugin version and notify of any updates that happened
    let reactVersion = null;
    for (const reaction of reactions) {
      if (reaction.channelId == "version") {
        reactVersion = reaction;
        break;
      }
    }

    if (reactVersion && reactVersion.messageId != null && reactVersion.messageId != pluginVersion) {
      console.info(
        `[ReactionThreads-Menu] Plugin updated to version ${pluginVersion}, please read the changelog at ${changelogUrl} as there may be important or breaking changes!`,
      );
      reactions.splice(reactions.indexOf(reactVersion), 1);
      reactions.push({ channelId: "version", messageId: pluginVersion });
      saveReactions();
    } else if (reactVersion == null) {
      reactions.push({ channelId: "version", messageId: pluginVersion });
      saveReactions();
    }
    //#endregion versioncheck

    //#region registering
    // Register all commands and listeners
    commands.addInboxServerCommand(
      "rtDescription",
      [
        { name: "channelId", type: "string", required: true },
        { name: "messageId", type: "string", required: true },
        { name: "emoji", type: "string", required: true },
        { name: "description", type: "string", required: false, catchAll: true },
      ],
      ReactionDescCmd
    );

    commands.addGlobalCommand("menu", [], menuCmd)

    commands.addInboxServerCommand("menutest", [], menuTestCmd);

    bot.on("messageReactionAdd", onPrivReactionAdd);
    //#endregion registering
  }
};
