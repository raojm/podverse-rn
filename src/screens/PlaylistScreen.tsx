import { StyleSheet, View as RNView } from 'react-native'
import { NavigationScreenOptions } from 'react-navigation'
import React, { setGlobal } from 'reactn'
import { ActionSheet, ActivityIndicator, ClipTableCell, Divider, EpisodeTableCell, FlatList,
  NavQueueIcon, NavShareIcon, PlaylistTableHeader, View } from '../components'
import { alertIfNoNetworkConnection } from '../lib/network'
import { convertToNowPlayingItem } from '../lib/NowPlayingItem'
import { decodeHTMLString, removeHTMLFromString } from '../lib/utility'
import { PV } from '../resources'
import { getPlaylist, toggleSubscribeToPlaylist } from '../state/actions/playlist'
import { core } from '../styles'

type Props = {
  navigation?: any
}

type State = {
  endOfResultsReached: boolean
  isLoading: boolean
  isLoadingMore: boolean
  isSubscribed: boolean
  isSubscribing: boolean
  playlist?: any
  playlistId?: string
  selectedItem?: any
  showActionSheet: boolean
}

export class PlaylistScreen extends React.Component<Props, State> {

  static navigationOptions = ({ navigation }) => {
    const playlistId = navigation.getParam('playlistId')
    return {
      title: 'Playlist',
      headerRight: (
        <RNView style={core.row}>
          <NavShareIcon url={PV.URLs.playlist + playlistId} />
          <NavQueueIcon navigation={navigation} />
        </RNView>
      )
    } as NavigationScreenOptions
  }

  constructor(props: Props) {
    super(props)
    const { subscribedPlaylistIds } = this.global.session.userInfo
    const playlist = this.props.navigation.getParam('playlist')
    const playlistId = (playlist && playlist.id) || this.props.navigation.getParam('playlistId')
    const isSubscribed = subscribedPlaylistIds.some((x: string) => playlistId)

    if (playlist && playlist.id) {
      this.props.navigation.setParams({ playlistId: playlist.id })
    }

    this.state = {
      endOfResultsReached: false,
      isLoading: true,
      isLoadingMore: false,
      isSubscribed,
      isSubscribing: false,
      playlist,
      playlistId,
      showActionSheet: false
    }

    setGlobal({
      screenPlaylist: {
        flatListData: [],
        flatListDataTotalCount: null,
        playlist: null
      }
    })
  }

  async componentDidMount() {
    this._initializePageData()
  }

  async _initializePageData() {
    const playlistId = this.props.navigation.getParam('playlistId') || this.state.playlistId

    this.setState({
      endOfResultsReached: false,
      isLoading: true,
      playlistId
    }, async () => {
      setGlobal({
        flatListData: [],
        flatListDataTotalCount: null,
        playlist: null
      }, async () => {
        try {
          await getPlaylist(playlistId, this.global)
        } catch (error) {
          //
        }
        this.setState({ isLoading: false })
      })
    })
  }

  _ItemSeparatorComponent = () => {
    return <Divider />
  }

  _renderItem = ({ item }) => {
    const { downloads } = this.global
    if (item.startTime) {
      return (
        <ClipTableCell
          key={item.id}
          endTime={item.endTime}
          episodePubDate={item.episode.pubDate}
          episodeTitle={item.episode.title}
          handleMorePress={() => this._handleMorePress(convertToNowPlayingItem(item, null, null))}
          podcastImageUrl={item.episode.podcast.imageUrl}
          podcastTitle={item.episode.podcast.title}
          startTime={item.startTime}
          title={item.title} />
      )
    } else {
      let description = removeHTMLFromString(item.description)
      description = decodeHTMLString(description)
      return (
        <EpisodeTableCell
          key={item.id}
          description={description}
          downloads={downloads}
          handleMorePress={() => this._handleMorePress(convertToNowPlayingItem(item, null, null))}
          handleNavigationPress={() => this.props.navigation.navigate(
            PV.RouteNames.MoreEpisodeScreen,
            { episode: item })
          }
          item={item.id}
          podcastImageUrl={item.podcast.imageUrl}
          podcastTitle={item.podcast.title}
          pubDate={item.pubDate}
          title={item.title} />
      )
    }
  }

  _handleEditPress = () => {
    this.props.navigation.navigate(
      PV.RouteNames.EditPlaylistScreen,
      { playlist: this.global.screenPlaylist.playlist }
    )
  }

  _handleToggleSubscribe = async (id: string) => {
    const wasAlerted = await alertIfNoNetworkConnection('subscribe to playlist')
    if (wasAlerted) return

    this.setState({ isSubscribing: true }, async () => {
      try {
        await toggleSubscribeToPlaylist(id, this.global)
        const { subscribedPlaylistIds } = this.global.session.userInfo
        const isSubscribed = subscribedPlaylistIds.some((x: string) => id)
        this.setState({
          isSubscribed,
          isSubscribing: false
        })
      } catch (error) {
        this.setState({ isSubscribing: false })
      }
    })
  }

  _handleCancelPress = () => {
    return new Promise((resolve, reject) => {
      this.setState({ showActionSheet: false }, resolve)
    })
  }

  _handleMorePress = (selectedItem: any) => {
    this.setState({
      selectedItem,
      showActionSheet: true
    })
  }

  render() {
    const { navigation } = this.props
    const { isLoading, isLoadingMore, isSubscribed, isSubscribing, playlistId,
      selectedItem, showActionSheet } = this.state
    const { screenPlaylist, session } = this.global
    const playlist = screenPlaylist.playlist ? screenPlaylist.playlist : navigation.getParam('playlist')
    const flatListData = screenPlaylist.flatListData || []
    const flatListDataTotalCount = screenPlaylist.flatListDataTotalCount || 0
    const isLoggedInUserPlaylist = ((playlist && playlist.owner && playlist.owner.id) === session.userInfo.id)

    return (
      <View style={styles.view}>
        <PlaylistTableHeader
          createdBy={isLoggedInUserPlaylist && playlist && playlist.owner ? playlist.owner.name : null}
          handleEditPress={isLoggedInUserPlaylist ? this._handleEditPress : null}
          handleToggleSubscribe={isLoggedInUserPlaylist ? null : () => this._handleToggleSubscribe(playlistId)}
          id={playlistId}
          isLoading={isLoading && !playlist}
          isNotFound={!isLoading && !playlist}
          isSubscribed={isSubscribed}
          isSubscribing={isSubscribing}
          itemCount={playlist && playlist.itemCount}
          lastUpdated={playlist && playlist.updatedAt}
          title={playlist && playlist.title} />
        {
          isLoading &&
            <ActivityIndicator />
        }
        {
          !isLoading && flatListData &&
            <FlatList
              data={flatListData}
              dataTotalCount={flatListDataTotalCount}
              disableLeftSwipe={true}
              extraData={flatListData}
              isLoadingMore={isLoadingMore}
              ItemSeparatorComponent={this._ItemSeparatorComponent}
              renderItem={this._renderItem} />
        }
        <ActionSheet
          handleCancelPress={this._handleCancelPress}
          items={PV.ActionSheet.media.moreButtons(
            selectedItem, this.global.session.isLoggedIn, this.global, navigation, this._handleCancelPress
          )}
          showModal={showActionSheet} />
      </View>
    )
  }
}

const styles = StyleSheet.create({
  view: {
    flex: 1
  }
})
