import Vue from 'vue';
import sample from 'lodash/sample';
import { StatefulService, mutation, ViewHandler } from 'services/core/stateful-service';
import { UserService, LoginLifecycle } from 'services/user';
import { HostsService } from 'services/hosts';
import { Inject } from 'services/core/injector';
import { $t } from 'services/i18n';
import { InitAfter } from 'services/core';
import * as pages from 'components/pages/community-hub/pages';
import { handleResponse, authorizedHeaders } from 'util/requests';
import Utils from 'services/utils';
import { ChatWebsocketService } from './chat-websocket';

export interface IFriend {
  id: number;
  name: string;
  avatar: string;
  is_prime?: boolean;
  user_id?: number;
  status?: string;
  is_friend?: boolean;
  chat_names?: Array<string>;
  game_streamed?: string;
}
export interface IChatRoom {
  name: string;
  title: string;
  avatar: string;
  token?: string;
}

interface ICommunityHubState {
  connectedUsers: Dictionary<IFriend>;
  friendRequests: Array<IFriend>;
  chatrooms: Array<IChatRoom>;
  status: string;
  currentPage: string;
  self: IFriend;
}

const chatBgColor = () =>
  sample(['#2B5BD7', '#C22571', '#5E3BEC', '#758D14', '#36ADE0', '#EB7777', '#C57BFF', '#D5FF7B']);

const PAGES = () => ({
  matchmaking: { title: $t('Matchmaking'), component: pages.MatchmakeForm },
  friendsPage: { title: $t('Friends'), component: pages.FriendsPage },
});

class CommunityHubViews extends ViewHandler<ICommunityHubState> {
  get currentPage() {
    return PAGES()[this.state.currentPage] || { component: pages.ChatPage };
  }

  usersInRoom(roomName: string) {
    return Object.values(this.state.connectedUsers).filter(user =>
      user.chat_names.includes(roomName),
    );
  }

  userInRoom(userId: number, roomName: string) {
    return Object.values(this.state.connectedUsers).find(
      user => user.id === userId && user.chat_names.includes(roomName),
    );
  }

  get sortedFriends() {
    return Object.values(this.state.connectedUsers)
      .filter(friend => friend.is_friend)
      .sort((a, b) => {
        if (a.status === b.status) return 0;
        if (a.status === 'streaming' && b.status !== 'streaming') return -1;
        if (a.status === 'online' && b.status !== 'streaming') return -1;
        return 1;
      });
  }

  get onlineFriendCount() {
    return this.sortedFriends.filter(friend => friend.status !== 'offline').length;
  }

  get groupChats() {
    return this.state.chatrooms.filter(chatroom => this.usersInRoom(chatroom.name).length > 1);
  }

  get directMessages() {
    return this.state.chatrooms.filter(chatroom => this.usersInRoom(chatroom.name).length < 2);
  }

  get currentChat() {
    return this.state.chatrooms.find(chatroom => chatroom.name === this.state.currentPage);
  }

  findFriend(friendId: number) {
    return Object.values(this.state.connectedUsers).find(friend => friend.id === friendId);
  }

  get roomsToJoin() {
    if (!this.state.chatrooms) return [];
    return this.state.chatrooms.map(chatroom => ({
      name: chatroom.name,
      token: chatroom.token,
      type: 'dm',
    }));
  }
}

@InitAfter('UserService')
export class CommunityHubService extends StatefulService<ICommunityHubState> {
  @Inject() private hostsService: HostsService;
  @Inject() private userService: UserService;
  @Inject() private chatWebsocketService: ChatWebsocketService;

  static initialState: ICommunityHubState = {
    connectedUsers: {},
    friendRequests: [],
    chatrooms: [],
    status: 'online',
    currentPage: 'matchmaking',
    self: {} as IFriend,
  };

  @mutation()
  ADD_USER(user: IFriend) {
    Vue.set(this.state.connectedUsers, user.id, user);
  }

  @mutation()
  EDIT_USER(userId: number, patch: Partial<IFriend>) {
    const changedParams = Utils.getChangedParams(this.state.connectedUsers[userId], patch);
    Vue.set(this.state.connectedUsers, userId, {
      ...this.state.connectedUsers[userId],
      ...changedParams,
      chat_names: this.state.connectedUsers[userId].chat_names.concat(patch.chat_names),
    });
  }

  @mutation()
  SET_FRIEND_REQUESTS(friendRequests: Array<IFriend>) {
    this.state.friendRequests = friendRequests;
  }

  @mutation()
  SET_CHATROOMS(chatrooms: Array<IChatRoom>) {
    this.state.chatrooms = chatrooms;
  }

  @mutation()
  ADD_CHATROOM(chatroom: IChatRoom) {
    this.state.chatrooms.push(chatroom);
  }

  @mutation()
  LEAVE_CHATROOM(chatroomName: string) {
    this.state.chatrooms = this.state.chatrooms.filter(chatroom => chatroom.name !== chatroomName);
  }

  @mutation()
  SET_CURRENT_PAGE(page: string) {
    this.state.currentPage = page;
  }

  @mutation()
  SET_SELF(self: IFriend) {
    this.state.self = self;
  }

  lifecycle: LoginLifecycle;

  async init() {
    this.lifecycle = await this.userService.withLifecycle({
      init: this.fetchUserData,
      destroy: () => Promise.resolve(),
      context: this,
    });
  }

  async fetchUserData() {
    await this.getFriends();
    await this.getFriendRequests();
    await this.getChatrooms();
    Promise.all(this.state.chatrooms.map(room => this.getChatMembers(room.name)));
  }

  async getResponse(endpoint: string) {
    const url = `https://${this.hostsService.streamlabs}/api/v5/slobs-chat/${endpoint}`;
    const headers = authorizedHeaders(this.userService.apiToken);
    const request = new Request(url, { headers });
    return await fetch(request).then(handleResponse);
  }

  async postResponse(endpoint: string, body?: any) {
    const url = `https://${this.hostsService.streamlabs}/api/v5/slobs-chat/${endpoint}`;
    const headers = authorizedHeaders(
      this.userService.apiToken,
      new Headers({ 'Content-Type': 'application/json' }),
    );
    const request = new Request(url, { headers, body: JSON.stringify(body), method: 'POST' });
    return await fetch(request).then(handleResponse);
  }

  async getFriends() {
    const resp = await this.getResponse('friends');
    const mappedFriends = resp.data.map((friend: IFriend) => ({
      ...friend,
      chat_names: [] as Array<string>,
      is_friend: true,
    }));
    this.updateUsers(mappedFriends);
  }

  async getChatMembers(chatroomName: string) {
    const resp = await this.getResponse(`dm/members?dmName=${chatroomName}`);
    if (resp.data) {
      const notSelf = resp.data.filter((user: IFriend) => user.id !== this.self.id);
      this.updateUsers(notSelf.map((user: IFriend) => ({ ...user, chat_names: [chatroomName] })));
    }
  }

  async sendFriendRequest(friendId: number) {
    this.postResponse('friend/request', { friendId });
  }

  async sendFriendRequestByName(name: string) {
    const platform = this.userService.platform.type;
    try {
      this.postResponse('friend/request', { [`${platform}Id`]: name });
    } catch (e) {
      return Promise.reject($t('No user found with that name'));
    }
  }

  async getFriendRequests() {
    const resp = await this.getResponse('friend/request');
    this.SET_FRIEND_REQUESTS(resp.data);
  }

  async respondToFriendRequest(request: IFriend, accepted: boolean) {
    const endpoint = `friend/${accepted ? 'accept' : 'reject'}`;
    this.postResponse(endpoint, { requestId: request.id });
    if (accepted) {
      this.updateUsers([
        { ...request, is_friend: true, chat_names: [], status: 'offline', id: request.user_id },
      ]);
    }
    const filteredRequests = this.state.friendRequests.filter(req => req.id !== request.id);
    this.SET_FRIEND_REQUESTS(filteredRequests);
  }

  addFriendRequest(friendRequest: IFriend) {
    this.SET_FRIEND_REQUESTS([friendRequest, ...this.state.friendRequests]);
  }

  async unfriend(friend: IFriend) {
    this.postResponse('friend/remove', { friendId: friend.id });
    this.updateUsers([{ ...friend, is_friend: false }]);
  }

  async getChatrooms() {
    const resp = await this.getResponse('settings');
    this.SET_CHATROOMS(resp.chatrooms || []);
  }

  async leaveChatroom(groupId: string) {
    this.postResponse('group/leave', { groupId });
    this.LEAVE_CHATROOM(groupId);
  }

  updateUsers(users: Array<IFriend>) {
    users.forEach(user => {
      if (user.id === this.self.id) return;
      if (!this.state.connectedUsers[user.id]) {
        this.ADD_USER(user);
      } else {
        this.EDIT_USER(user.id, user);
      }
    });
  }

  setPage(page: string) {
    this.SET_CURRENT_PAGE(page);
  }

  async createChat(title: string, members: Array<IFriend>) {
    const queryMembers = members.map(member => `friends[]=${member.id}`).join('&');
    const resp = await this.getResponse(`dm?${queryMembers}&title=${title}`);
    const dmAvatar = members.length === 1 ? members[0].avatar : null;
    this.chatWebsocketService.joinRoom(resp);
    this.updateUsers(members.map(member => ({ ...member, chat_names: [resp.name] })));
    this.addChat(resp.name, resp.token, title, dmAvatar);
  }

  addChat(name: string, token: string, title: string, avatar?: string) {
    const imageOrCode = avatar || chatBgColor();
    this.ADD_CHATROOM({ name, title, avatar: imageOrCode, token });
    this.setPage(name);
  }

  get views() {
    return new CommunityHubViews(this.state);
  }

  get self(): IFriend {
    return this.state.self;
  }

  set self(self: IFriend) {
    this.SET_SELF(self);
  }
}