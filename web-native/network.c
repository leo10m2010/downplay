// SPDX-License-Identifier: GPL-3.0-or-later
// Browser adapter around Revived's original GPL client.c/json.c, not a second
// lobby implementation. Calls are serialized on one Web Worker event loop.
#include "client.h"
#include <emscripten.h>
#include <string.h>
static NetClient client;
static NetLobby lobby;
static unsigned char buffer[65537];
static int initialized;
EM_JS(void, emit, (int binary,const void* data,int n), {Module.onSend?.(binary,HEAPU8.slice(data,data+n));});
static void text(void* ctx,const char* value){(void)ctx;emit(0,value,strlen(value));}
static void binary(void* ctx,const void* value,size_t n){(void)ctx;emit(1,value,n);}
EMSCRIPTEN_KEEPALIVE void wn_init(const char* name,const char* version,const char* hash){if(initialized)client_free(&client);client_init(&client,name,version,hash);initialized=1;}
EMSCRIPTEN_KEEPALIVE void wn_open(void){NetTransport transport={0,text,binary};client_connected(&client,&transport);}
EMSCRIPTEN_KEEPALIVE void* wn_buffer(void){return buffer;}
EMSCRIPTEN_KEEPALIVE void wn_message(int binary_message,int n){if(n<0||n>65536)return;buffer[n]=0;if(binary_message)client_on_binary(&client,buffer,n);else client_on_text(&client,(char*)buffer,n);}
EMSCRIPTEN_KEEPALIVE int wn_closed(int code,const char* reason){return client_on_closed(&client,code,reason);}
EMSCRIPTEN_KEEPALIVE int wn_tick(void){return client_tick(&client);}
EMSCRIPTEN_KEEPALIVE void* wn_lobby(void){client_lobby(&client,&lobby);return &lobby;}
EMSCRIPTEN_KEEPALIVE int wn_lobby_size(void){return sizeof lobby;}
/* UI reads the same snapshot copied to the original game, without ABI offsets. */
EMSCRIPTEN_KEEPALIVE int wn_member_count(void){return lobby.nmembers;}
EMSCRIPTEN_KEEPALIVE int wn_member_id(int i){return i>=0&&i<lobby.nmembers&&i<NET_MAX_SLOTS?lobby.member[i].id:-1;}
EMSCRIPTEN_KEEPALIVE int wn_local_slot(void){return lobby.local_slot;}
EMSCRIPTEN_KEEPALIVE const char* wn_member_name(int i){return i>=0&&i<lobby.nmembers&&i<NET_MAX_SLOTS?lobby.member[i].name:"";}
EMSCRIPTEN_KEEPALIVE int wn_member_ready(int i){return i>=0&&i<lobby.nmembers&&i<NET_MAX_SLOTS?lobby.member[i].ready:0;}
EMSCRIPTEN_KEEPALIVE int wn_member_ping(int i){return i>=0&&i<lobby.nmembers&&i<NET_MAX_SLOTS?lobby.member[i].rtt_ms:-1;}
EMSCRIPTEN_KEEPALIVE int wn_ping(void){return lobby.ping_ms;}
EMSCRIPTEN_KEEPALIVE const char* wn_error(void){return lobby.error;}
EMSCRIPTEN_KEEPALIVE void wn_room(int track,int laps,int pub,int max,long long seed,const char* name){NetRoomSettings s={track,laps,pub,max,seed,name};client_set_room(&client,&s);}
EMSCRIPTEN_KEEPALIVE void wn_pick(int member,int rider,int bike){client_pick(&client,member,rider,bike);}
EMSCRIPTEN_KEEPALIVE void wn_ready(int ready){client_ready(&client,ready);}
EMSCRIPTEN_KEEPALIVE void wn_start(void){client_start(&client);}
EMSCRIPTEN_KEEPALIVE void wn_finish(unsigned ticks,int place){client_finish(&client,ticks,place);}
EMSCRIPTEN_KEEPALIVE void wn_back(void){client_back(&client);}
EMSCRIPTEN_KEEPALIVE void wn_rules(int finish_window,int next,int then){client_rules(&client,finish_window,next,then);}
EMSCRIPTEN_KEEPALIVE void wn_rotation(int count){if(count>=0&&count<=64)client_rotation(&client,buffer,count);}
EMSCRIPTEN_KEEPALIVE void wn_end(void){client_end(&client);}
EMSCRIPTEN_KEEPALIVE void wn_leave(void){client_leave(&client);}
EMSCRIPTEN_KEEPALIVE int wn_racing(void){return client.racing;}
EMSCRIPTEN_KEEPALIVE double wn_seconds(void){return net_now_ms()/1000;}
EMSCRIPTEN_KEEPALIVE double wn_server_ms(void){return net_now_ms()+client.clock_offset;}
EMSCRIPTEN_KEEPALIVE int wn_send(int type,int n){return n<0||n>3070?0:client_send_frame(&client,type,buffer,n);}
EMSCRIPTEN_KEEPALIVE int wn_receive(int max){return client_receive_frame(&client,buffer,max>65536?65536:max);}
