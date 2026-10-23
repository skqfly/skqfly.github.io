import site from "./data/site.json" with { type: "json" };
import type {
  NavBarLink, SocialLink, Identity, AboutPageContent,
  ProjectPageContent, BlogPageContent, HomePageContent,
} from "./types/config";

export const identity: Identity = site.identity;
export const navBarLinks: NavBarLink[] = site.navBarLinks;
export const socialLinks: SocialLink[] = site.socialLinks;
export const homePageContent: HomePageContent = site.homePageContent;
export const aboutPageContent: AboutPageContent = site.aboutPageContent;
export const projectsPageContent: ProjectPageContent = site.projectsPageContent;
export const blogPageContent: BlogPageContent = site.blogPageContent;
export const talksPageContent = site.talksPageContent;
export const friendsPageContent = site.friendsPageContent;
